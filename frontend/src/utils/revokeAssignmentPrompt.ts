import { Alert } from 'react-native';
import { SellerAllocation } from '../types';

type RevokeFn = (assignmentId: string) => Promise<{
  success: boolean;
  message?: string;
  soldG1Nets?: number;
  soldG2Nets?: number;
  returnedG1Nets?: number;
  returnedG2Nets?: number;
}>;

/** Prompts Master to confirm revoking an active stock assignment and reclaims unsold nets. */
export function confirmAndRevokeAssignment(
  alloc: SellerAllocation,
  revokeSellerAssignment: RevokeFn
): void {
  const g1Left = Math.max(0, alloc.grade1Allocated - alloc.grade1Sold);
  const g2Left = Math.max(0, alloc.grade2Allocated - alloc.grade2Sold);

  Alert.alert(
    'Revoke Stock Assignment?',
    `${alloc.sellerName} has sold ${alloc.grade1Sold} G1 & ${alloc.grade2Sold} G2 nets.\n\nRevoking will return the remaining ${g1Left} G1 & ${g2Left} G2 nets to you so you can carry on selling.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke & Reclaim',
        style: 'destructive',
        onPress: async () => {
          const res = await revokeSellerAssignment(alloc.id);
          if (res.success) {
            Alert.alert(
              'Assignment Revoked',
              `Sold: ${res.soldG1Nets ?? 0} G1 & ${res.soldG2Nets ?? 0} G2 nets.\nReturned to your stock: ${res.returnedG1Nets ?? 0} G1 & ${res.returnedG2Nets ?? 0} G2 nets.`
            );
          } else {
            Alert.alert('Revoke Failed', res.message || 'Please try again.');
          }
        },
      },
    ]
  );
}
