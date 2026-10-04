import { requestDeduplication } from '../../../src/middlewares/request-deduplication.js';
import type { Request, Response, NextFunction } from 'express';

describe('Request Deduplication Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock<void>;
  let jsonSpy: jest.Mock;
  let sendSpy: jest.Mock;

  beforeEach(() => {
    jsonSpy = jest.fn().mockReturnValue(undefined);
    sendSpy = jest.fn().mockReturnValue(undefined);

    mockReq = {
      method: 'POST',
      path: '/api/test',
      body: { test: 'data' },
      user: { userId: 123 },
    };

    mockRes = {
      json: jsonSpy,
      send: sendSpy,
      status: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('GET requests', () => {
    it('should skip deduplication for GET requests', () => {
      mockReq.method = 'GET';

      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip deduplication for HEAD requests', () => {
      mockReq.method = 'HEAD';

      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip deduplication for OPTIONS requests', () => {
      mockReq.method = 'OPTIONS';

      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Duplicate detection', () => {
    it('should allow first request to proceed', () => {
      mockReq.method = 'POST';

      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should block duplicate POST requests', async () => {
      mockReq.method = 'POST';
      mockReq.path = '/api/create';

      // First request
      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      // Simulate immediate second request
      const statusSpy = jest.fn().mockReturnThis();
      mockRes.status = statusSpy;

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Second identical request
      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(409);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Solicitud duplicada'),
        })
      );
    });

    it('should allow different POST requests', () => {
      mockReq.method = 'POST';
      mockReq.path = '/api/create';

      // First request
      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Different path
      mockReq.path = '/api/different';
      mockNext.mockClear();

      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should consider different request bodies', () => {
      mockReq.method = 'POST';

      // First request
      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Different body
      mockReq.body = { different: 'data' };
      mockNext.mockClear();

      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should consider different user IDs', () => {
      mockReq.method = 'POST';

      // First request
      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Different user
      (mockReq.user as Record<string, unknown>).userId = 456;
      mockNext.mockClear();

      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('PUT requests', () => {
    it('should track PUT requests for deduplication', async () => {
      mockReq.method = 'PUT';
      mockReq.path = '/api/update/1';

      // First request
      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Second identical request
      const statusSpy = jest.fn().mockReturnThis();
      mockRes.status = statusSpy;

      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(409);
    });
  });

  describe('DELETE requests', () => {
    it('should track DELETE requests for deduplication', async () => {
      mockReq.method = 'DELETE';
      mockReq.path = '/api/delete/1';

      // First request
      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Second identical request
      const statusSpy = jest.fn().mockReturnThis();
      mockRes.status = statusSpy;

      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(409);
    });
  });

  describe('Request cleanup', () => {
    it('should cleanup request on response finish', () => {
      mockReq.method = 'POST';
      let finishCallback: (() => void) | null = null;

      (mockRes.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
        return mockRes;
      });

      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      // Simulate response finishing
      if (finishCallback) {
        finishCallback();
      }

      // Now a duplicate request should be allowed (cleaned up)
      mockNext.mockClear();
      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should cleanup request on response close', () => {
      mockReq.method = 'POST';
      let closeCallback: (() => void) | null = null;

      (mockRes.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
        return mockRes;
      });

      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      // Simulate response closing
      if (closeCallback) {
        closeCallback();
      }

      // Now a duplicate request should be allowed (cleaned up)
      mockNext.mockClear();
      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Anonymous users', () => {
    it('should handle anonymous users without user object', () => {
      mockReq.method = 'POST';
      mockReq.user = undefined;

      requestDeduplication(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
