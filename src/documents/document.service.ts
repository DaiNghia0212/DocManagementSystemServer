import { AppDataSource } from '../database/data-source';
import { singleton } from 'tsyringe';
import { ILike, In, IsNull, Not, Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { CreateDocumentDto } from './dtos/create-document.dto';
import { User } from '../users/entities/user.entity';
import { Folder } from '../folders/entities/folder.entity';
import { UUID } from '../lib/global.type';
import { DocumentStatus } from '../constants/enum';
import { Category } from '../categories/entities/category.entity';
import { FindDocumentDto } from './dtos/find-document.dto';
import { UpdateDocumentDto } from './dtos/update-document.dto';
import { compareImage } from '../lib/file';
import fs from 'fs';
import { BorrowHistory } from '../borrow_requests/entities/borrow_history.entity';

@singleton()
export class DocumentService {
  private documentRepository: Repository<Document>;
  private categoryRepository: Repository<Category>;
  private borrowHistoryRepository: Repository<BorrowHistory>;

  constructor() {
    this.documentRepository = AppDataSource.getRepository(Document);
    this.categoryRepository = AppDataSource.getRepository(Category);
    this.borrowHistoryRepository = AppDataSource.getRepository(BorrowHistory);
  }

  public async getOne(
    id: UUID,
    status?: DocumentStatus[],
    createdBy?: User,
    departmentId?: UUID,
    withStorageUrl?: boolean
  ) {
    try {
      return await this.documentRepository.findOne({
        where: {
          id: id,
          ...(departmentId && {
            folder: {
              locker: {
                room: {
                  department: {
                    id: departmentId,
                  },
                },
              },
            },
          }),
          ...(status && { status: In(status) }),
          ...(createdBy && {
            createdBy: {
              id: createdBy.id,
            },
          }),
        },
        relations: {
          folder: {
            locker: {
              room: {
                department: true,
              },
            },
          },
          category: true,
          createdBy: true,
          updatedBy: true,
        },
        ...(withStorageUrl && {
          select: [
            'id',
            'name',
            'description',
            'status',
            'numOfPages',
            'createdAt',
            'updatedAt',
            'storageUrl',
          ],
        }),
      });
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  public async getMany(
    status: DocumentStatus[],
    dto: FindDocumentDto,
    departmentId?: UUID,
    sortDateDESC?: boolean
  ) {
    const take = dto.take || 10;
    const page = dto.page || 1;
    const skip = (page - 1) * take;
    const keyword = dto.keyword || '';
    const sortName = dto.sortName;
    const skipPagination = dto.skipPagination || 0;
    try {
      const [result, total] = await this.documentRepository.findAndCount({
        where: {
          name: ILike('%' + keyword + '%'),
          folder: {
            ...(departmentId && {
              locker: {
                room: {
                  department: {
                    id: departmentId,
                  },
                },
              },
            }),
            ...(dto.folderId && { id: dto.folderId }),
          },
          status: In(status),
        },
        relations: {
          folder: {
            locker: {
              room: {
                department: true,
              },
            },
          },
          category: true,
        },
        order: {
          ...(sortDateDESC && {
            updatedAt: sortDateDESC ? 'DESC' : 'ASC',
            createdAt: sortDateDESC ? 'DESC' : 'ASC',
          }),
          name: sortName ? 'ASC' : 'DESC',
        },
        ...(!skipPagination && { take: take, skip: skip }),
      });
      return { data: result, total: total };
    } catch (error) {
      console.log(error);
      return { data: [], total: 0 };
    }
  }

  public async count(status: DocumentStatus[], departmentId?: UUID) {
    try {
      return await this.documentRepository.count({
        where: {
          status: In(status),
          ...(departmentId && {
            folder: {
              locker: {
                room: {
                  department: {
                    id: departmentId,
                  },
                },
              },
            },
          }),
        },
      });
    } catch (error) {
      console.log(error);
      return 0;
    }
  }

  public async create(createDocumentDto: CreateDocumentDto, createdBy: User) {
    try {
      // check if department contains category
      const category = await this.categoryRepository.findOne({
        where: {
          id: createDocumentDto.category.id,
          department: {
            rooms: {
              lockers: {
                folders: {
                  id: createDocumentDto.folder.id,
                },
              },
            },
          },
        },
      });
      if (!category) {
        return 'Category is not existed in this location.';
      }
      // check if folder has enough capacity
      const folder = await AppDataSource.getRepository(Folder).findOne({
        where: {
          id: createDocumentDto.folder.id,
        },
        relations: ['documents'],
      });
      if (folder) {
        if (
          folder.documents
            .filter((document) =>
              [
                DocumentStatus.AVAILABLE,
                DocumentStatus.BORROWED,
                DocumentStatus.PENDING,
              ].includes(document.status)
            )
            .reduce((sum, document) => sum + document.numOfPages, 0) +
            createDocumentDto.numOfPages >
          folder.capacity
        ) {
          return 'Not have enough space in Folder.';
        }
      } else {
        return 'Folder not existed.';
      }
      const document = this.documentRepository.create(createDocumentDto);
      document.createdBy = createdBy;
      const result = await this.documentRepository.save(document);
      console.log(result.id);
      return result;
    } catch (error: any) {
      console.log('====');
      console.error(error?.driverError?.detail);
      console.log('====');
      if (error?.driverError?.detail?.includes('already exists')) {
        return 'Document name is already existed.';
      }
      return null;
    }
  }

  public async update(updateDocumentDto: UpdateDocumentDto, updatedBy: User) {
    try {
      const document = await this.getOne(updateDocumentDto.id, [
        DocumentStatus.AVAILABLE,
      ]);
      if (!document) {
        return 'Document not existed.';
      }

      // check if department contains category
      const category = await this.categoryRepository.findOne({
        where: {
          id: updateDocumentDto.category.id,
          department: {
            id: document.folder.locker.room.department.id,
          },
        },
      });
      if (!category) {
        return 'Category not existed in this department.';
      }

      const result = await this.documentRepository.update(
        {
          id: updateDocumentDto.id,
        },
        {
          name: updateDocumentDto.name,
          description: updateDocumentDto.description,
          category: {
            id: updateDocumentDto.category.id,
          },
          updatedBy: updatedBy,
        }
      );
      return result.affected === 1;
    } catch (error: any) {
      console.log('====');
      console.error(error?.driverError?.detail);
      console.log('====');
      if (error?.driverError?.detail?.includes('already exists')) {
        return 'Document name is already existed.';
      }
      return false;
    }
  }

  public async updateStorageUrl(
    documentId: UUID,
    fileName: string,
    updatedBy: User
  ) {
    try {
      const result = await this.documentRepository.update(
        {
          id: documentId,
        },
        {
          storageUrl: fileName,
          updatedBy: updatedBy,
        }
      );
      return result.affected === 1;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  public async deleteStorageUrl(documentId: UUID, departmentId?: UUID) {
    const document = await this.documentRepository.findOne({
      where: {
        id: documentId,
        storageUrl: Not(IsNull()),
        ...(departmentId && {
          folder: {
            locker: {
              room: {
                department: {
                  id: departmentId,
                },
              },
            },
          },
        }),
      },
      select: ['id', 'storageUrl'],
    });

    if (document) {
      fs.unlink('uploads/' + document.storageUrl, (err) => {
        if (err) console.log(err);
      });
      fs.unlink('temp/' + `${document.storageUrl.split('.')[0]}.png`, (err) => {
        if (err) console.log(err);
      });
    }
  }

  public async checkDuplicatePercent(fileName: string, departmentId?: UUID) {
    try {
      const documentList = await this.documentRepository.find({
        where: {
          status: In([
            DocumentStatus.AVAILABLE,
            DocumentStatus.BORROWED,
            DocumentStatus.PENDING,
            DocumentStatus.REQUESTING,
          ]),
          storageUrl: Not(IsNull()),
          ...(departmentId && {
            folder: {
              locker: {
                room: {
                  department: {
                    id: departmentId,
                  },
                },
              },
            },
          }),
        },
        select: ['id', 'storageUrl'],
      });
      if (documentList.length === 0)
        return {
          id: null,
          duplicatePercent: 0,
        };

      const compareImageList = await Promise.all(
        documentList.map((document) =>
          compareImage(fileName, document.storageUrl, document.id)
        )
      );

      console.log(compareImageList);

      const max = compareImageList.reduce((prev, current) =>
        prev.duplicatePercent > current.duplicatePercent ? prev : current
      );
      return max;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  public async confirm(documentId: UUID, folderId: UUID, updatedBy: User) {
    try {
      const result = await this.documentRepository.update(
        {
          id: documentId,
          status: DocumentStatus.PENDING,
          folder: {
            id: folderId,
          },
        },
        {
          status: DocumentStatus.AVAILABLE,
          updatedBy: updatedBy,
        }
      );
      return result.affected === 1;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  public async deletePendingDocument(documentId: UUID, updatedBy: User) {
    try {
      const result = await this.documentRepository.update(
        {
          id: documentId,
          status: DocumentStatus.PENDING,
        },
        {
          status: DocumentStatus.DELETED,
          updatedBy: updatedBy,
        }
      );
      return result.affected === 1;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  public async checkReturn(id: UUID) {
    try {
      const document = await this.documentRepository.findOne({
        where: {
          id: id,
          status: DocumentStatus.BORROWED,
        },
        relations: {
          borrowHistories: true,
        },
        order: {
          borrowHistories: {
            startDate: 'DESC',
          },
        },
      });
      if (!document) {
        return null;
      }

      const borrowHistory = document.borrowHistories.find(
        (history) =>
          history.startDate <= new Date() && history.endDate >= new Date()
      );
      if (!borrowHistory) {
        return 'Document can be returned but late.';
      }
      return true;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  public async return(id: UUID, updatedBy: User, note?: string) {
    try {
      const borrowHistories = await this.borrowHistoryRepository.find({
        where: {
          document: {
            id: id,
            status: DocumentStatus.BORROWED,
          },
        },
        order: {
          startDate: 'DESC',
        },
        relations: {
          document: true,
        },
      });
      console.log('borrowHistories:: ', borrowHistories);

      if (borrowHistories.length === 0) {
        return null;
      }

      const borrowHistory = borrowHistories[0];
      borrowHistory.document.status = DocumentStatus.AVAILABLE;
      borrowHistory.document.updatedBy = updatedBy;
      borrowHistory.returnDate = new Date();
      note && (borrowHistory.note = note);

      return await this.borrowHistoryRepository.save(borrowHistory);
    } catch (error) {
      console.log(error);
      return null;
    }
  }
}
