import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDocumentDto, ownerId: string) {
    return this.prisma.document.create({
      data: {
        name: dto.name,
        description: dto.description,
        createdById: ownerId,
        editors: { connect: { id: ownerId } },
      },
      select: {
        id: true,
        name: true,
        createdById: true,
        createdAt: true,
      },
    });
  }

  async findAll() {
    return this.prisma.document.findMany({
      select: {
        id: true,
        name: true,
        createdById: true,
        createdAt: true,
      },
    });
  }

  async findOne(documentId: string, userId: string) {
    // Same authorization rule as SyncGateway's join-room handler: only editors may open the document.
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, editors: { some: { id: userId } } },
      select: {
        id: true,
        name: true,
        createdById: true,
        createdAt: true,
      },
    });

    if (!document) throw new NotFoundException();

    return document;
  }
}
