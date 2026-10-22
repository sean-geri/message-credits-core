import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MessageNotFoundError } from '../common/errors/message-not-found.error';
import {
  DispatchOutcome,
  DispatchResult,
} from '../database/entities/dispatch-result.entity';
import { Message } from '../database/entities/message.entity';
import { MessageStatus } from '../database/entities/message-status.enum';

@Injectable()
export class RecordDispatchResultService {
  constructor(private readonly dataSource: DataSource) {}

  async execute(
    messageId: string,
    result: DispatchOutcome,
    reportedAt: Date,
  ): Promise<{ message: Message; changed: boolean }> {
    return this.dataSource.transaction(async (manager) => {
      const message = await manager.findOne(Message, {
        where: { id: messageId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!message) {
        throw new MessageNotFoundError(messageId);
      }

      await manager.insert(DispatchResult, {
        messageId,
        result,
        reportedAt,
      });

      if (!statusChanges(message.status, result)) {
        return { message, changed: false };
      }

      message.status =
        result === 'accepted' ? MessageStatus.Accepted : MessageStatus.Rejected;
      message.resolvedAt = reportedAt;
      const saved = await manager.save(message);

      return { message: saved, changed: true };
    });
  }
}

function statusChanges(
  current: MessageStatus,
  result: DispatchOutcome,
): boolean {
  if (current === result) {
    return false;
  }

  if (current === MessageStatus.Accepted && result === 'rejected') {
    return false;
  }

  return true;
}
