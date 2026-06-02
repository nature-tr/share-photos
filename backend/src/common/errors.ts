import { ErrorCode, type ErrorCodeValue } from '@photo/shared';

export class BizError extends Error {
  constructor(
    public readonly code: ErrorCodeValue | string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'BizError';
  }
}

export const Errors = {
  validation: (msg = '参数不合法', details?: unknown) =>
    new BizError(ErrorCode.VALIDATION_FAILED, msg, 400, details),
  unauthorized: (msg = '未登录') =>
    new BizError(ErrorCode.UNAUTHORIZED, msg, 401),
  forbidden: (msg = '无权访问') =>
    new BizError(ErrorCode.FORBIDDEN, msg, 403),
  invalidCredentials: () =>
    new BizError(ErrorCode.INVALID_CREDENTIALS, '邮箱或密码错误', 401),
  emailTaken: () =>
    new BizError(ErrorCode.EMAIL_TAKEN, '该邮箱已被注册', 409),
  tokenExpired: () =>
    new BizError(ErrorCode.TOKEN_EXPIRED, 'access token 已过期', 401),
  refreshInvalid: () =>
    new BizError(ErrorCode.REFRESH_INVALID, 'refresh token 无效', 401),
  refreshReused: () =>
    new BizError(ErrorCode.REFRESH_REUSED, 'refresh token 被重放，已强制下线', 401),

  shareNotFound: () =>
    new BizError(ErrorCode.SHARE_NOT_FOUND, '分享不存在', 404),
  shareExpired: () =>
    new BizError(ErrorCode.SHARE_EXPIRED, '分享已过期', 410),
  shareEnded: () =>
    new BizError(ErrorCode.SHARE_ENDED, '分享已结束', 410),
  shareCleaned: () =>
    new BizError(ErrorCode.SHARE_CLEANED, '分享已被清理', 410),

  photoNotFound: () =>
    new BizError(ErrorCode.PHOTO_NOT_FOUND, '照片不存在', 404),
  fileTooLarge: () =>
    new BizError(ErrorCode.FILE_TOO_LARGE, '文件过大', 413),
  unsupportedMediaType: (mime?: string) =>
    new BizError(ErrorCode.UNSUPPORTED_MEDIA_TYPE, `不支持的图片格式${mime ? `：${mime}` : ''}`, 415),
  photoLimitExceeded: () =>
    new BizError(ErrorCode.PHOTO_LIMIT_EXCEEDED, '该分享照片数量已达上限', 400),
  invalidImage: () =>
    new BizError(ErrorCode.INVALID_IMAGE, '无效或损坏的图片', 400),

  internal: (msg = '服务器内部错误') =>
    new BizError(ErrorCode.INTERNAL_ERROR, msg, 500),
};
