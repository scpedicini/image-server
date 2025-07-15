/**
 * Interface for thumbnail storage systems
 */
export interface ThumbnailStorage {
  initialize(): Promise<void>;
  getImage(hash: string): Promise<string | undefined>;
  saveImage(hash: string, imagePath: string, sceneVariation?: number): Promise<void>;
  deleteAll(): Promise<void>;
}