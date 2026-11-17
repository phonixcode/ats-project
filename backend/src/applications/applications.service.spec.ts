import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  const prisma = {
    application: { findMany: jest.fn(), deleteMany: jest.fn() },
    candidate: { deleteMany: jest.fn() },
    review: { createMany: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApplicationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ApplicationsService>(ApplicationsService);
  });

  it('deletes candidates, orphaned people and their resume files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mgats-'));
    const fileDir = join(dir, 'ab12cd34');
    mkdirSync(fileDir);
    const file = join(fileDir, 'resume.pdf');
    writeFileSync(file, 'x');
    prisma.application.findMany.mockResolvedValue([
      { candidateId: 'c1', rawFilePath: file },
    ]);

    const result = await service.removeMany(['a1']);

    expect(result).toEqual({ removed: 1 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.candidate.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['c1'] }, applications: { none: {} } },
    });
    expect(existsSync(file)).toBe(false);
    expect(existsSync(fileDir)).toBe(false);
  });

  it('says so when none of the candidates exist', async () => {
    prisma.application.findMany.mockResolvedValue([]);
    await expect(service.removeMany(['missing'])).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('records one decision per selected candidate', async () => {
    prisma.review.createMany.mockResolvedValue({ count: 2 });
    const result = await service.reviewMany(['a1', 'a2'], 'SHORTLIST');
    expect(result).toEqual({ reviewed: 2 });
    expect(prisma.review.createMany).toHaveBeenCalledWith({
      data: [
        { applicationId: 'a1', humanDecision: 'SHORTLIST' },
        { applicationId: 'a2', humanDecision: 'SHORTLIST' },
      ],
    });
  });
});
