import type { PhotoInput, VideoInput, CarouselInput } from './inputs';
import type { PhotoOutput, CarouselOutput, VideoOutput } from './outputs';
import type { VideoDuration } from './catalogs';

export type CreationType = 'video' | 'photo' | 'carousel';

export type CreateCreationRequest =
  | { type: 'video'; input: VideoInput; duration: VideoDuration }
  | { type: 'photo'; input: PhotoInput }
  | { type: 'carousel'; input: CarouselInput };

export type CreateCreationResponse =
  | { id: string; type: 'video'; output: VideoOutput }
  | { id: string; type: 'photo'; output: PhotoOutput }
  | { id: string; type: 'carousel'; output: CarouselOutput };

export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'AI_FAILED'
  | 'RATE_LIMIT'
  | 'PAYMENT_REQUIRED'
  | 'INTERNAL';

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
}
