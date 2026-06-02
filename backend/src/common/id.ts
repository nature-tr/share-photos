import { customAlphabet } from 'nanoid';
import { SHARE_CODE_ALPHABET, SHARE_CODE_LENGTH } from '@photo/shared';

const idAlphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export const newId = customAlphabet(idAlphabet, 16);
export const newJti = customAlphabet(idAlphabet, 21);
export const newShareCode = customAlphabet(SHARE_CODE_ALPHABET, SHARE_CODE_LENGTH);
