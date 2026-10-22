export enum MessageStatus {
  Pending = 'pending',
  Accepted = 'accepted', // final: charged, never reverts
  Rejected = 'rejected', // may still become accepted (late/out-of-order report)
}
