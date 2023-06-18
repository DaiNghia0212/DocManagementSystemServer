import { RequestStatus } from '../../constants/enum';
export class FindImportRequestDto {
  //   /**
  //    * @isString
  //    * @optional
  //    */
  //   keyword?: string;

  /**
   * Request status filter
   * @optional
   */
  status?: RequestStatus;

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
}