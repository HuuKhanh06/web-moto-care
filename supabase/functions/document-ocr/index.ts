import { createOcrHandler } from './handler.ts';

Deno.serve(createOcrHandler((key) => Deno.env.get(key)));
