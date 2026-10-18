/**
 * Promise.withResolvers — доступний у рантаймі Node 22+/24,
 * але відсутній у TS lib ES2023 (target проєкту, Lab 1 core).
 * Декларація лише типів; поведінка рантайму не змінюється.
 */
interface PromiseConstructor {
  withResolvers<T>(): {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
  };
}
