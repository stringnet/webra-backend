// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller() // Asegúrate de que @Controller() esté aquí
export class AppController { // Asegúrate de que 'export' esté aquí
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('status') // Ejemplo de otro endpoint
  getAppStatus(): { status: string; message: string; timestamp: string } {
    return this.appService.getAppStatus();
  }
}
