import {Test, TestingModule} from "@nestjs/testing";
import {ExecutionContext, HttpException, HttpStatus} from "@nestjs/common";
import {CACHE_MANAGER} from "@nestjs/cache-manager";
import {RateLimitGuard} from "./rate-limit.guard";

describe("RateLimitGuard", () => {
  let guard: any;
  let mockCacheManager: any;

  beforeEach(async () => {
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn()
    };

    const GuardClass = RateLimitGuard({
      limit: 3,
      ttl: 300
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuardClass,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager
        }
      ]
    }).compile();

    guard = module.get(GuardClass);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("should allow request when under rate limit", async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {_id: "user123"},
          route: {path: "/test"},
          TESTING_SKIP_CHECK: false
        })
      })
    } as ExecutionContext;

    mockCacheManager.get.mockResolvedValue(0);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockCacheManager.set).toHaveBeenCalledWith(
      expect.stringContaining("rate-limit:/test:user123"),
      1,
      300000
    );
  });

  it("should block request when rate limit is exceeded", async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {_id: "user123"},
          route: {path: "/test"},
          TESTING_SKIP_CHECK: false
        })
      })
    } as ExecutionContext;

    mockCacheManager.get.mockResolvedValue(3);

    await expect(guard.canActivate(mockContext)).rejects.toThrow(HttpException);
    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          statusCode: HttpStatus.TOO_MANY_REQUESTS
        })
      })
    );
  });

  it("should skip rate limiting in test environment", async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {_id: "user123"},
          route: {path: "/test"},
          TESTING_SKIP_CHECK: true
        })
      })
    } as ExecutionContext;

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockCacheManager.get).not.toHaveBeenCalled();
    expect(mockCacheManager.set).not.toHaveBeenCalled();
  });
});
