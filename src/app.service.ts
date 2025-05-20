// src/app.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /**
   * Devuelve un mensaje de bienvenida o el estado de la aplicación.
   * Este método es comúnmente utilizado por AppController.
   * @returns Un string con el mensaje.
   */
  getHello(): string {
    return '¡Bienvenido al Backend de WebRA ScanMee!';
  }

  /**
   * Podrías añadir otros métodos de utilidad general aquí si es necesario.
   * Por ejemplo, un método para verificar el estado de la aplicación.
   * @returns Un objeto con el estado de la aplicación.
   */
  getAppStatus(): { status: string; message: string; timestamp: string } {
    return {
      status: 'ok',
      message: 'El servicio está funcionando correctamente.',
      timestamp: new Date().toISOString(),
    };
  }
}
