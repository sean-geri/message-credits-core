import { INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { DatabaseModule } from './../src/database/database.module';
import { OrdersModule } from './../src/orders/orders.module';

@Module({})
class EmptyDatabaseModule {}

@Module({})
class EmptyOrdersModule {}

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(DatabaseModule)
      .useModule(EmptyDatabaseModule)
      .overrideModule(OrdersModule)
      .useModule(EmptyOrdersModule)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({
        status: 'ok',
        info: { app: { status: 'up' } },
        error: {},
        details: { app: { status: 'up' } },
      });
  });
});
