import { DomainError } from './domain.error';

export class ScheduleTimeInPastError extends DomainError {
  readonly code = 'SCHEDULE_TIME_IN_PAST';

  constructor() {
    super('time is in the past');
  }
}
