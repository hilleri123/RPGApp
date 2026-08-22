import { BaseApiClient } from './base';

export class ImagesApiService extends BaseApiClient {
  private readonly endpoint = '/images';

  // Получить все локации (опционально по сценарию)
  async getImages(
    filter?: string
  ): Promise<string[]> {
    const images = await this.get<string[]>(`${this.endpoint}/${filter}`);
    return images;
  }

}

export const imagesApiService = new ImagesApiService();
