// node-cron 3.x não publica typings e não há @types/node-cron instalado.
// Declaração ambiente mínima com apenas a API usada no server.ts (schedule),
// tipada de verdade para não cair em `any` sob noImplicitAny (B7).
declare module "node-cron" {
  interface ScheduledTask {
    start(): void;
    stop(): void;
  }

  interface ScheduleOptions {
    scheduled?: boolean;
    timezone?: string;
  }

  export function schedule(
    cronExpression: string,
    func: () => void | Promise<void>,
    options?: ScheduleOptions
  ): ScheduledTask;

  const cron: { schedule: typeof schedule };
  export default cron;
}
