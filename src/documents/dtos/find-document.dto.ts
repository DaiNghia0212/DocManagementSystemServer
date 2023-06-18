import { UUID } from '../../lib/global.type';
export class FindDocumentDto {
  /**
   * @isString
   * @optional
   */
  keyword?: string;

  /**
   * Default 10
   * @isNumber
   * @minimum 1
   * @isInt
   * @default 10
   * @optional
   */
  take?: number;

  /**
   * Default 1
   * @isNumber
   * @minimum 1
   * @isInt
   * @default 1
   * @optional
   */
  page?: number;

  /**
   * @isUUID
   * @isString
   * @optional
   */
  folderId?: UUID;
}
