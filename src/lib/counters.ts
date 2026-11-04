// [PHASE4A] Counter tuần tự. Dùng trong runTransaction: READS trước, WRITES sau.
import { doc, type Firestore, type Transaction } from "firebase/firestore";

export const counterRef = (db: Firestore, name: string) => doc(db, "_counters", name);

export async function readSeq(tx: Transaction, db: Firestore, name: string): Promise<number> {
  const s = await tx.get(counterRef(db, name));
  return s.exists() ? Number(s.data().seq) || 0 : 0;
}

export function writeSeq(tx: Transaction, db: Firestore, name: string, seq: number) {
  tx.set(counterRef(db, name), { seq }, { merge: true });
}
