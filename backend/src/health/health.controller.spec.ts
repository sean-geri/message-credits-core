import { Test, TestingModule } from '@nestjs/testing';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
    }).compile();

    controller = module.get(HealthController);
  });

  it('reports the application as up', async () => {
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      info: { app: { status: 'up' } },
      error: {},
      details: { app: { status: 'up' } },
    });
  });
});
