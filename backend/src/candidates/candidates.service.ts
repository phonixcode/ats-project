import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(private prisma: PrismaService) {}

  findOrCreate(data: { name?: string; email?: string; phone?: string }) {
    if (data.email) {
      return this.prisma.candidate.upsert({
        where: { email: data.email },
        update: {},
        create: data,
      });
    }
    return this.prisma.candidate.create({ data });
  }

  async updateIdentity(
    id: string,
    data: { name?: string; email?: string; phone?: string },
  ) {
    try {
      return await this.prisma.candidate.update({ where: { id }, data });
    } catch (err) {
      // unique constraint on email means this person already has a candidate record
      // from an earlier application — merge into it rather than losing the link
      if (data.email) {
        const existing = await this.prisma.candidate.findUnique({
          where: { email: data.email },
        });
        if (existing && existing.id !== id) {
          this.logger.log(
            `Merging duplicate candidate ${id} into existing candidate ${existing.id} (matched by email)`,
          );

          // reassign every application currently pointing at the blank duplicate
          await this.prisma.application.updateMany({
            where: { candidateId: id },
            data: { candidateId: existing.id },
          });

          // clean up the now-orphaned blank record
          await this.prisma.candidate
            .delete({ where: { id } })
            .catch(() => null);

          return existing;
        }
      }

      this.logger.warn(
        `Could not update candidate ${id} identity: ${err.message}`,
      );
      return null;
    }
  }

  findAll() {
    return this.prisma.candidate.findMany({ orderBy: { createdAt: 'desc' } });
  }
}
