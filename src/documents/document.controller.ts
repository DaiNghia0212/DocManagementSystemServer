import { CreateDocumentDto } from './dtos/create-document.dto';
import {
  Route,
  Post,
  Response,
  Controller,
  UploadedFile,
  Tags,
  Security,
  Request,
  Body,
  Path,
  Get,
  Queries,
} from 'tsoa';
import { BadRequestError, SuccessResponse } from '../constants/response';
import { injectable } from 'tsyringe';
import { DocumentService } from './document.service';
import { Document } from './entities/document.entity';
import { UUID } from '../lib/global.type';
import fs from 'fs';
import { base64toUUID, uuidToBase64 } from '../lib/barcode';
import { ConfirmDocumentDto } from './dtos/confirm-document.dto';
import { DocumentStatus } from '../constants/enum';
import { FindDocumentDto } from './dtos/find-document.dto';

@injectable()
@Tags('Document')
@Route('documents')
export class DocumentController extends Controller {
  constructor(private documentService: DocumentService) {
    super();
  }

  /**
   * Retrieves document barcode.(STAFF only)
   * @param id The id of document
   */
  @Security('api_key', ['STAFF'])
  @Get('/barcode/:id')
  @Response<Document>(200)
  @Response<BadRequestError>(400)
  public async getBarcode(@Path() id: UUID, @Request() request: any) {
    const result = await this.documentService.getOne(id);
    if (result !== null)
      return new SuccessResponse('Success', {
        ...result,
        barcode: uuidToBase64(result.id),
      });
    else throw new BadRequestError('Document not existed.');
  }

  /**
   * Retrieves stored documents. (AVAILABLE and BORROWED status)
   * If user is EMPLOYEE, only get stored documents of folder in own department.
   * @param folderId The id of folder (optional)
   */
  @Security('api_key', ['STAFF', 'EMPLOYEE'])
  @Get('')
  @Response<Document[]>(200)
  public async getMany(@Request() request: any, @Queries() dto: FindDocumentDto) {
    return new SuccessResponse(
      'Success',
      await this.documentService.getMany(
        [DocumentStatus.AVAILABLE, DocumentStatus.BORROWED],
        dto,
        request.user.role === 'EMPLOYEE' ? request.user.departmentId : undefined
      )
    );
  }

  /**
   * Retrieves pending documents waiting for confirmation. (PENDING status) (STAFF only)
   * @param folderId The id of folder (optional)
   */
  @Security('api_key', ['STAFF'])
  @Get('pending')
  @Response<Document[]>(200)
  public async getManyPending(@Queries() dto: FindDocumentDto) {
    return new SuccessResponse(
      'Success',
      await this.documentService.getMany([DocumentStatus.PENDING], dto)
    );
  }

    /**
   * Retrieves a document.
   * If user is EMPLOYEE, only get document in own department.
   * @param id The id of document
   */
    @Security('api_key', ['STAFF', 'EMPLOYEE'])
    @Get('/:id')
    @Response<Document>(200)
    @Response<BadRequestError>(400)
    public async getOne(@Path() id: UUID, @Request() request: any) {
      const result = await this.documentService.getOne(
        id,
        request.user.role === 'EMPLOYEE' ? request.user.departmentId : undefined // if user is employee, only get folder of his department
      );
      if (result !== null) return new SuccessResponse('Success', result);
      else throw new BadRequestError('Document not existed.');
    }

  /**
   * Create new document (STAFF only)
   */
  @Post('')
  @Security('api_key', ['STAFF'])
  @Response<SuccessResponse>(200)
  public async create(
    @Request() request: any,
    @Body() createDocumentDto: CreateDocumentDto
  ): Promise<any> {
    const result = await this.documentService.create(
      createDocumentDto,
      request.user
    );
    if (result instanceof Document)
      return new SuccessResponse('Success', {
        id: result.id,
        barcode: uuidToBase64(result.id),
      });
    if (result == null) throw new BadRequestError('Failed to create document.');
    else throw new BadRequestError(result);
  }

  /**
   * Upload pdf file for document (STAFF only)
   */
  @Post('upload/:id')
  @Security('api_key', ['STAFF'])
  @Response<SuccessResponse>(200)
  public async upload(
    @Request() request: any,
    @Path() id: UUID,
    @UploadedFile() file: Express.Multer.File
  ): Promise<any> {
    console.log(file);
    const document = await this.documentService.getOne(
      id,
      request.user.departmentId
    );
    if (document == null) {
      fs.unlink(__dirname + '/../../uploads/' + file.filename, (err) => {
        if (err) console.log(err);
      });
      throw new BadRequestError('Document not existed.');
    } else {
      if (document.storageUrl != null) {
        fs.unlink(
          __dirname + '/../../uploads/' + document.storageUrl,
          (err) => {
            if (err) console.log(err);
          }
        );
      }
    }

    const result = await this.documentService.update(
      document.id,
      file.filename,
      request.user
    );
    if (result) return new SuccessResponse('Success', result);
    else throw new BadRequestError('Failed to upload file of document.');
  }

  /**
   * After scan location of document. Confirm document is located in correct place (STAFF only)
   */
  @Post('confirm')
  @Security('api_key', ['STAFF'])
  @Response<SuccessResponse>(200)
  public async confirm(
    @Request() request: any,
    @Body() confirmDocumentDto: ConfirmDocumentDto
  ): Promise<any> {
    console.log(base64toUUID(confirmDocumentDto.locationQRcode));
    const folderId = base64toUUID(confirmDocumentDto.locationQRcode);

    const result = await this.documentService.confirm(
      confirmDocumentDto.id,
      folderId,
      request.user
    );

    if (result) return new SuccessResponse('Success', result);
    else
      throw new BadRequestError(
        'Failed to confirm document is placed in correct place.'
      );
  }
}
