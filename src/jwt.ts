// src/jwt.ts
import * as jwt from 'jsonwebtoken'

export const secret = process.env.JWT_SECRET || 'ThisIsASeriousSecretCode.LookAtThisScramble>0123456789<SuchIntricateWow'
const ttl = 3600 * 24 * 7 // our JWT tokens are valid for 1 week

interface IJwtPayload {
  id: number;
}

export const sign = (data: IJwtPayload) =>
  jwt.sign({ data }, secret, { expiresIn: ttl })

export const verify = (token: string): { data: IJwtPayload } =>
  jwt.verify(token, secret) as { data: IJwtPayload }
