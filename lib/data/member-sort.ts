import type { Member } from "@/types/domain";

const fixedOrder = ["鈴木 優", "渡辺 穣", "浅里 綾夏", "飛山 佳枝"];

export function sortMembersForDirectory(members: Member[]) {
  return [...members].sort((a, b) => {
    const aFixed = fixedOrder.indexOf(a.name);
    const bFixed = fixedOrder.indexOf(b.name);

    if (aFixed !== -1 || bFixed !== -1) {
      if (aFixed === -1) return 1;
      if (bFixed === -1) return -1;
      return aFixed - bFixed;
    }

    return Number(a.memberNo) - Number(b.memberNo);
  });
}
