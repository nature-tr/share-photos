/** 业务错误码枚举 */
export declare const ErrorCode: {
    readonly VALIDATION_FAILED: "VALIDATION_FAILED";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
    readonly RATE_LIMITED: "RATE_LIMITED";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly INVALID_CREDENTIALS: "INVALID_CREDENTIALS";
    readonly EMAIL_TAKEN: "EMAIL_TAKEN";
    readonly TOKEN_EXPIRED: "TOKEN_EXPIRED";
    readonly REFRESH_INVALID: "REFRESH_INVALID";
    readonly REFRESH_REUSED: "REFRESH_REUSED";
    readonly SHARE_NOT_FOUND: "SHARE_NOT_FOUND";
    readonly SHARE_EXPIRED: "SHARE_EXPIRED";
    readonly SHARE_ENDED: "SHARE_ENDED";
    readonly SHARE_CLEANED: "SHARE_CLEANED";
    readonly PHOTO_NOT_FOUND: "PHOTO_NOT_FOUND";
    readonly FILE_TOO_LARGE: "FILE_TOO_LARGE";
    readonly UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE";
    readonly PHOTO_LIMIT_EXCEEDED: "PHOTO_LIMIT_EXCEEDED";
    readonly INVALID_IMAGE: "INVALID_IMAGE";
};
export type ErrorCodeKey = keyof typeof ErrorCode;
export type ErrorCodeValue = (typeof ErrorCode)[ErrorCodeKey];
