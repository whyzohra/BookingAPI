import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Global validation pipe with class-validator and class-transformer
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
    }),
  );

  // OpenAPI / Swagger setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Appointment Booking API')
    .setDescription(
      'REST API for fixed-slot appointment bookings featuring robust concurrency double-booking prevention, real-time Socket.IO notifications, and comprehensive OpenAPI documentation.',
    )
    .setVersion('1.0.0')
    .addTag('Slots', 'View available appointment slots')
    .addTag('Bookings', 'Create and cancel appointment bookings')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    customSiteTitle: 'Appointment Booking API Documentation',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();
