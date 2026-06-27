import type { ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  MatchClockCommand,
  MatchStatus,
  MatchType,
  UserRole,
  buildAdjustMinuteClockState,
  buildInitialClockState,
  buildNextPeriodClockState,
  buildPauseClockState,
  buildResumeClockState,
  computeMatchClockDisplay,
  computeElapsedSecondsInPeriod,
  matchClockDtoToStateInput,
} from '@velocesport/shared';
import { getPool } from '../src/config/db.js';
import { userRoleRepository } from '../src/repositories/user-role.repository.js';
import { getTestSeed } from './helpers.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return res.body.data.accessToken as string;
}

function futureDatetime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}

describe('Match clock pure functions', () => {
  const t0 = Date.parse('2026-06-19T15:00:00.000Z');

  it('computes elapsed while running from timestamps', () => {
    const state = {
      currentPeriod: 1,
      elapsedSeconds: 120,
      running: true,
      periodStartedAtMs: t0,
    };
    expect(computeElapsedSecondsInPeriod(state, t0 + 90_000)).toBe(210);
    expect(computeMatchClockDisplay(state, t0 + 90_000).minute).toBe(3);
  });

  it('pause freezes minute; resume continues from frozen base', () => {
    const running = buildInitialClockState(t0);
    const at90 = t0 + 90_000;
    const paused = buildPauseClockState(running, at90);
    expect(computeMatchClockDisplay(paused, at90 + 60_000).minute).toBe(1);
    const resumed = buildResumeClockState(paused, at90 + 60_000);
    expect(computeMatchClockDisplay(resumed, at90 + 120_000).minute).toBe(2);
  });

  it('next period resets elapsed to zero', () => {
    const running = {
      currentPeriod: 1,
      elapsedSeconds: 0,
      running: true,
      periodStartedAtMs: t0,
    };
    const atP1 = buildPauseClockState(running, t0 + 2_700_000);
    const p2 = buildNextPeriodClockState(atP1, t0 + 2_700_000, 2);
    expect(p2.currentPeriod).toBe(2);
    expect(computeMatchClockDisplay(p2, t0 + 2_760_000).minute).toBe(1);
  });

  it('adjust minute recalculates elapsed coherently', () => {
    const running = buildInitialClockState(t0);
    const adjusted = buildAdjustMinuteClockState(running, t0 + 10_000, 23);
    expect(adjusted.elapsedSeconds).toBe(23 * 60);
    expect(computeMatchClockDisplay(adjusted, t0 + 70_000).minute).toBe(24);
  });

  it('reconstructs same display after simulated reload from DTO', () => {
    const paused = buildPauseClockState(buildInitialClockState(t0), t0 + 125_000);
    const dto = {
      currentPeriod: paused.currentPeriod,
      elapsedSeconds: paused.elapsedSeconds,
      running: paused.running,
      periodStartedAt: null,
      pausedAt: new Date(t0 + 125_000).toISOString(),
      minute: computeMatchClockDisplay(paused, t0 + 125_000).minute,
    };
    const reloaded = matchClockDtoToStateInput(dto);
    expect(computeMatchClockDisplay(reloaded, t0 + 999_000)).toEqual(
      computeMatchClockDisplay(paused, t0 + 999_000),
    );
  });
});

describe('Match clock API', () => {
  let seed: ReturnType<typeof getTestSeed>;
  let adminAToken: string;
  let adminBToken: string;
  let coachToken: string;
  let coachOtherToken: string;

  let categoryId: number;
  let coachId: number;
  let matchId: number;

  const coachPassword = 'CoachClock123!';

  beforeAll(async () => {
    seed = getTestSeed();
    adminAToken = await loginAs('admin-a@test.com', seed.passwords.admin);
    adminBToken = await loginAs('admin-b@test.com', seed.passwords.admin);

    const pool = getPool();
    const coachHash = await bcrypt.hash(coachPassword, 10);

    const catRes = await request(app)
      .post('/api/tenant/categories')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'Sub-11 Reloj' })
      .expect(201);
    categoryId = catRes.body.data.id as number;

    const [coachResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-clock@test.com', coachHash, UserRole.COACH, seed.academyAId, 'active'],
    );
    coachId = coachResult.insertId;
    await userRoleRepository.assignRole(coachId, UserRole.COACH, seed.academyAId);
    await pool.execute(
      'INSERT INTO coach_categories (coach_user_id, category_id, tenant_id) VALUES (?, ?, ?)',
      [coachId, categoryId, seed.academyAId],
    );

    const [coachOtherResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-other-clock@test.com', coachHash, UserRole.COACH, seed.academyAId, 'active'],
    );
    await userRoleRepository.assignRole(coachOtherResult.insertId, UserRole.COACH, seed.academyAId);

    coachToken = await loginAs('coach-clock@test.com', coachPassword);
    coachOtherToken = await loginAs('coach-other-clock@test.com', coachPassword);

    const matchRes = await request(app)
      .post('/api/tenant/matches')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        categoryId,
        opponent: 'Rival Reloj',
        matchDatetime: futureDatetime(),
        matchType: MatchType.FRIENDLY,
        periodsCount: 2,
        periodDurationMinutes: 45,
      })
      .expect(201);
    matchId = matchRes.body.data.id as number;

    await request(app)
      .patch(`/api/tenant/matches/${matchId}/status`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ status: MatchStatus.IN_PROGRESS })
      .expect(200);
  });

  it('starts clock when match goes in_progress', async () => {
    const res = await request(app)
      .get(`/api/tenant/matches/${matchId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(res.body.data.clock).toMatchObject({
      currentPeriod: 1,
      elapsedSeconds: 0,
      running: true,
      minute: 0,
    });
    expect(res.body.data.clock.periodStartedAt).toBeTruthy();
  });

  it('only assigned coach controls clock (403 admin and other coach)', async () => {
    await request(app)
      .patch(`/api/tenant/matches/${matchId}/clock`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ command: MatchClockCommand.PAUSE })
      .expect(403);

    await request(app)
      .patch(`/api/tenant/matches/${matchId}/clock`)
      .set('Authorization', `Bearer ${coachOtherToken}`)
      .send({ command: MatchClockCommand.PAUSE })
      .expect(403);
  });

  it('pause and resume persist reconstructible state', async () => {
    await request(app)
      .patch(`/api/tenant/matches/${matchId}/clock`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ command: MatchClockCommand.PAUSE })
      .expect(200);

    const paused = await request(app)
      .get(`/api/tenant/matches/${matchId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const pausedMinute = paused.body.data.clock.minute as number;
    expect(paused.body.data.clock.running).toBe(false);

    await new Promise((r) => setTimeout(r, 1100));

    const reloaded = await request(app)
      .get(`/api/tenant/matches/${matchId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(reloaded.body.data.clock.minute).toBe(pausedMinute);

    await request(app)
      .patch(`/api/tenant/matches/${matchId}/clock`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ command: MatchClockCommand.RESUME })
      .expect(200);

    expect(
      (
        await request(app)
          .get(`/api/tenant/matches/${matchId}`)
          .set('Authorization', `Bearer ${coachToken}`)
          .expect(200)
      ).body.data.clock.running,
    ).toBe(true);
  });

  it('advance period resets minute for new period', async () => {
    await request(app)
      .patch(`/api/tenant/matches/${matchId}/clock`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ command: MatchClockCommand.ADJUST, minute: 44 })
      .expect(200);

    await request(app)
      .patch(`/api/tenant/matches/${matchId}/clock`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ command: MatchClockCommand.NEXT_PERIOD })
      .expect(200);

    const res = await request(app)
      .get(`/api/tenant/matches/${matchId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(res.body.data.clock.currentPeriod).toBe(2);
    expect(res.body.data.clock.minute).toBe(0);
  });

  it('adjust minute updates persisted reference', async () => {
    await request(app)
      .patch(`/api/tenant/matches/${matchId}/clock`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ command: MatchClockCommand.ADJUST, minute: 17 })
      .expect(200);

    const res = await request(app)
      .get(`/api/tenant/matches/${matchId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(res.body.data.clock.minute).toBe(17);
  });

  it('multi-tenant: coach from academy B cannot control academy A match', async () => {
    const pool = getPool();
    const coachHash = await bcrypt.hash(coachPassword, 10);
    const [coachBResult] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, ?, ?, ?, ?)',
      ['coach-b-clock@test.com', coachHash, UserRole.COACH, seed.academyBId, 'active'],
    );
    await userRoleRepository.assignRole(coachBResult.insertId, UserRole.COACH, seed.academyBId);
    const coachBToken = await loginAs('coach-b-clock@test.com', coachPassword);

    await request(app)
      .patch(`/api/tenant/matches/${matchId}/clock`)
      .set('Authorization', `Bearer ${coachBToken}`)
      .send({ command: MatchClockCommand.PAUSE })
      .expect(404);
  });
});
