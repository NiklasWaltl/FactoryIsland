import type {
  NetworkError,
  NetworkSlice,
  Reservation,
  ReservationId,
  ReservationOwnerKind,
} from "./reservationTypes";

export function unknownReservationErrorNetwork(
  network: NetworkSlice,
  input:
    | { reservationId: ReservationId }
    | { ownerKind: ReservationOwnerKind; ownerId: string },
): NetworkSlice {
  const lastError: NetworkError = "reservationId" in input
    ? {
      kind: "UNKNOWN_RESERVATION",
      message: `Reservation "${input.reservationId}" does not exist.`,
      reservationId: input.reservationId,
    }
    : {
      kind: "UNKNOWN_RESERVATION",
      message: `No reservations for owner "${input.ownerKind}:${input.ownerId}".`,
    };
  return {
    ...network,
    lastError,
  };
}

export function removeReservationByIndex(
  reservations: readonly Reservation[],
  idx: number,
): readonly Reservation[] {
  return [
    ...reservations.slice(0, idx),
    ...reservations.slice(idx + 1),
  ];
}

export function reservationsByOwner(
  reservations: readonly Reservation[],
  ownerKind: ReservationOwnerKind,
  ownerId: string,
): readonly Reservation[] {
  return reservations.filter(
    (r) => r.ownerKind === ownerKind && r.ownerId === ownerId,
  );
}

export function removeReservationsByIds(
  reservations: readonly Reservation[],
  reservationIds: ReadonlySet<ReservationId>,
): readonly Reservation[] {
  return reservations.filter((r) => !reservationIds.has(r.id));
}
