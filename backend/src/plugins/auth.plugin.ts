import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config/index.js';
import { Errors } from '../common/errors.js';

export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    currentUser?: AccessTokenPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

export const authPlugin = fp(async (app) => {
  await app.register(jwt, {
    secret: config.jwt.accessSecret,
    sign: { expiresIn: '15m' },
  });

  app.decorate('authenticate', async (req: FastifyRequest, _reply: FastifyReply) => {
    try {
      await req.jwtVerify<AccessTokenPayload>();
      req.currentUser = req.user;
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === 'FAST_JWT_EXPIRED') throw Errors.tokenExpired();
      throw Errors.unauthorized();
    }
  });
});
