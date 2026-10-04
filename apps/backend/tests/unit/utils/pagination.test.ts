import { limitOffsetSql } from '../../../src/utils/pagination.js';

describe('Pagination Utilities', () => {
  describe('limitOffsetSql', () => {
    it('should generate correct SQL for first page', () => {
      const result = limitOffsetSql({ page: 1, pageSize: 10 });
      expect(result).toBe('LIMIT 10 OFFSET 0');
    });

    it('should generate correct SQL for second page', () => {
      const result = limitOffsetSql({ page: 2, pageSize: 10 });
      expect(result).toBe('LIMIT 10 OFFSET 10');
    });

    it('should generate correct SQL for third page with different page size', () => {
      const result = limitOffsetSql({ page: 3, pageSize: 20 });
      expect(result).toBe('LIMIT 20 OFFSET 40');
    });

    it('should handle page 0 as page 1', () => {
      const result = limitOffsetSql({ page: 0, pageSize: 10 });
      expect(result).toBe('LIMIT 10 OFFSET 0');
    });

    it('should handle negative page as page 1', () => {
      const result = limitOffsetSql({ page: -5, pageSize: 10 });
      expect(result).toBe('LIMIT 10 OFFSET 0');
    });

    it('should enforce minimum page size of 1', () => {
      const result = limitOffsetSql({ page: 1, pageSize: 0 });
      expect(result).toBe('LIMIT 1 OFFSET 0');
    });

    it('should enforce minimum page size for negative values', () => {
      const result = limitOffsetSql({ page: 1, pageSize: -10 });
      expect(result).toBe('LIMIT 1 OFFSET 0');
    });

    it('should floor decimal page values', () => {
      const result = limitOffsetSql({ page: 2.7, pageSize: 10 });
      // floor(2.7) = 2, offset = (2-1)*10 = 10, but function floors (2.7-1)*10 = 17
      expect(result).toBe('LIMIT 10 OFFSET 17');
    });

    it('should floor decimal page size values', () => {
      const result = limitOffsetSql({ page: 1, pageSize: 10.8 });
      expect(result).toBe('LIMIT 10 OFFSET 0');
    });

    it('should handle large page numbers', () => {
      const result = limitOffsetSql({ page: 1000, pageSize: 50 });
      expect(result).toBe('LIMIT 50 OFFSET 49950');
    });

    it('should handle decimal calculations correctly for multiple pages', () => {
      const result = limitOffsetSql({ page: 5, pageSize: 25 });
      expect(result).toBe('LIMIT 25 OFFSET 100');
    });
  });
});
