import { IsIn } from 'class-validator';

// ON_CALL user khud set nahi karta — system karta hai jab customer khula ho
export const SELF_AVAILABILITY = ['AVAILABLE', 'BREAK', 'OFFLINE'] as const;

export class SetAvailabilityDto {
  @IsIn(SELF_AVAILABILITY)
  availability: (typeof SELF_AVAILABILITY)[number];
}
