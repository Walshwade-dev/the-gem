import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BatchProduct,
  BatchPurchaseCosts,
  CasualLaborer,
  CreditRepayment,
  CustomerCredit,
  DailyExpense,
  DailyReconciliation,
  OriginDetails,
  PaymentMethod,
  ProduceGrade,
  SaleTransaction,
  SellerAllocation,
  StaffActivityLog,
  TruckBatch,
  UserRole,
} from '../types';
import { apiFetch, ApiError } from '../services/api';
import { getOrCreateDeviceFingerprint, sellerTokenStorage } from '../services/authStorage';
import { BackendSyncPayload, mapSyncPayloadToStore } from '../services/syncMapper';

export interface AppState {
  // Session & RBAC
  role: UserRole;
  currentUserId: string;
  currentUserName: string;
  masterName: string;
  getMasterName: () => string;
  storeName: string;
  currentUserPhone: string;
  currentUserNationalId: string;
  isAuthenticated: boolean;
  isSyncing: boolean;
  lastSyncError?: string;

  // Security & Emergency Lockdown
  isLockedDown: boolean;
  lockdownReason?: string;

  // Active & Historical Batches
  currentBatch: TruckBatch | null;
  historicalBatches: TruckBatch[];

  // Stock Allocations & Sales
  allocations: SellerAllocation[];
  sales: SaleTransaction[];

  // Expenses & Labor
  expenses: DailyExpense[];
  expenseCategories: Array<{ id: string; code: string; label: string }>;
  casualLaborers: CasualLaborer[];

  // Credits & Repayments
  customerCredits: CustomerCredit[];
  creditRepayments: CreditRepayment[];

  // Reconciliations
  reconciliations: DailyReconciliation[];

  // App Settings
  isDarkMode: boolean;
  toggleTheme: () => void;
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  acceptedPaymentModes: Record<PaymentMethod, boolean>;
  togglePaymentMode: (mode: PaymentMethod) => void;

  // Policy Acceptance
  merchantPolicyAccepted: boolean;
  merchantPolicyAcceptedAt?: string;
  sellerPolicyAccepted: boolean;
  sellerPolicyAcceptedAt?: string;
  acceptPolicy: (role: UserRole) => Promise<void>;

  // Auth & Sync Actions
  syncFromServer: () => Promise<boolean>;
  selectActiveBatch: (batchId: string) => void;
  syncMasterWithClerk: (profile?: {
    email?: string;
    fullName?: string;
    storeName?: string;
  }) => Promise<{ success: boolean; message: string }>;
  restoreSellerSession: () => Promise<boolean>;
  requestSellerOtp: (
    phone: string,
    purpose?: 'LOGIN' | 'INVITE' | 'RESET_PASSPHRASE'
  ) => Promise<{ success: boolean; message: string; sellerName?: string }>;
  verifySellerOtp: (
    phone: string,
    otp: string,
    passphrase?: string,
    purpose?: 'LOGIN' | 'INVITE' | 'RESET_PASSPHRASE'
  ) => Promise<{ success: boolean; message: string; sellerName?: string }>;
  loginSellerWithPassphrase: (
    phone: string,
    passphrase: string
  ) => Promise<{ success: boolean; message: string; sellerName?: string }>;
  generateSellerInviteCode: (
    phone: string
  ) => Promise<{ success: boolean; code?: string; expiresAt?: string; message?: string }>;
  logout: () => Promise<void>;
  lockdown: (reason: string) => Promise<void>;
  unlock: () => Promise<{ success: boolean; message: string }>;

  // Profile / Config
  setRole: (role: UserRole) => void;
  setUserName: (name: string) => void;
  setStoreName: (name: string) => void;
  setUserPhone: (phone: string) => void;
  setUserNationalId: (id: string) => void;
  updateMasterProfile: (params: {
    adminName: string;
    storeName: string;
    phone: string;
    nationalId: string;
  }) => Promise<void>;
  updateBatchPurchaseCosts: (costs: Partial<BatchPurchaseCosts>) => Promise<void>;
  setBatchDay: (dayNumber: number) => void;

  // Batch Management
  createBatch: (params: {
    truckPlate: string;
    origin: OriginDetails;
    nccDeclaredNets: number;
    nccCessPaid: number;
    initialGrade1Nets: number;
    initialGrade2Nets: number;
    photoUrls: string[];
    qualityNotes?: string;
  }) => Promise<void>;
  advanceBatchDay: () => Promise<void>;
  closeCurrentBatch: () => Promise<void>;
  addBatchPhoto: (photoUrl: string, qualityNotes?: string) => void;
  batchProducts: BatchProduct[];
  addBatchProduct: (product: Omit<BatchProduct, 'id'>) => Promise<void>;
  deleteBatchProduct: (productId: string) => Promise<void>;
  updateBatchDetails: (params: {
    truckPlate?: string;
    originRegionName?: string;
    originSpecificLocation?: string;
    qualityNotes?: string;
  }) => Promise<void>;
  updateBatchProduct: (
    productId: string,
    params: {
      title?: string;
      packaging?: string;
      weightKg?: number;
      pricePerBag?: number;
      minPrice?: number;
      description?: string;
    }
  ) => Promise<void>;
  updateBatchPricing: (params: {
    pricePerBagGrade1?: number;
    minPriceGrade1?: number;
    pricePerBagGrade2?: number;
    minPriceGrade2?: number;
  }) => Promise<void>;
  createProductAndBatch: (params: {
    title: string;
    origin: string;
    truckPlate: string;
    packagingKg: number;
    priceGrade1: number;
    minPriceGrade1: number;
    stockGrade1: number;
    hasGrade2?: boolean;
    priceGrade2?: number;
    minPriceGrade2?: number;
    stockGrade2?: number;
    weightKgGrade2?: number;
    sizesGrade2?: string[];
    descriptionGrade2?: string;
    photoUrlsGrade2?: string[];
    photoUrls?: string[];
    description?: string;
    tags?: string[];
  }) => Promise<void>;

  // Seller Delegation
  allocateStockToSeller: (params: {
    sellerId: string;
    sellerName: string;
    sellerPhone: string;
    sellerNationalId?: string;
    grade1Allocated: number;
    grade2Allocated: number;
    expectedPriceG1: number;
    expectedPriceG2: number;
  }) => Promise<{ inviteCode?: string }>;
  updateSellerNationalId: (sellerId: string, nationalId: string) => Promise<void>;

  // Expenses & Deductions
  toggleNccCessPayment: () => Promise<void>;
  toggleExpensePaid: (categoryOrId: string) => Promise<void>;

  // Sales
  recordSale: (params: {
    grade: ProduceGrade;
    quantityNets: number;
    weighedGrams?: number;
    pricingMode?: 'PER_NET' | 'BY_WEIGHT';
    negotiatedUnitPrice: number;
    paymentMethod: PaymentMethod;
    buyerName?: string;
    buyerPhone?: string;
    buyerNationalId?: string;
    customerNotes?: string;
    mpesaReceiptCode?: string;
    buyerConsentConfirmed?: boolean;
    guarantorAccepted?: boolean;
  }) => Promise<{ success: boolean; message: string }>;

  // Credit Approvals & Repayments
  approveCreditSale: (creditEntryId: string) => Promise<void>;
  rejectCreditSale: (creditEntryId: string, reason?: string) => Promise<void>;
  recordCreditRepayment: (params: {
    customerId: string;
    creditEntryId: string;
    amount: number;
    paymentMethod: 'CASH' | 'MPESA';
    mpesaReceiptCode?: string;
    payerPhone?: string;
  }) => Promise<void>;

  // Expenses & Casual Labor
  addDailyExpense: (params: {
    batchId?: string;
    category: DailyExpense['category'];
    description: string;
    amount: number;
    paidVia: 'CASH' | 'MPESA';
    receiptRef?: string;
  }) => Promise<void>;
  addCasualLaborer: (params: {
    batchId?: string;
    workerName: string;
    task: CasualLaborer['task'];
    agreedWage: number;
    isPaid: boolean;
    paidVia?: 'CASH' | 'MPESA';
  }) => Promise<void>;
  markLaborerPaid: (laborerId: string, paidVia: 'CASH' | 'MPESA') => Promise<void>;

  // Reconciliation
  performCobReconciliation: (params: {
    physicalCountGrade1: number;
    physicalCountGrade2: number;
    actualCashInHand: number;
    notes?: string;
  }) => Promise<DailyReconciliation | null>;
  approveDailyReconciliation: (reconciliationId: string) => Promise<void>;

  // Acknowledgments & Discrepancies
  acknowledgeStockAllocation: (allocationId: string) => Promise<void>;
  reportStockDiscrepancy: (
    allocationId: string,
    params: { physicalG1: number; physicalG2: number; note: string }
  ) => Promise<void>;
  resolveStockDiscrepancy: (alertId: string) => Promise<void>;

  activityLogs: StaffActivityLog[];
  stockDiscrepancyAlerts: Array<{
    id: string;
    allocationId: string;
    sellerName: string;
    timestamp: string;
    physicalG1: number;
    physicalG2: number;
    expectedG1: number;
    expectedG2: number;
    note: string;
    status: 'PENDING' | 'RESOLVED';
  }>;

  resetToSampleData: () => Promise<void>;
}

const mapFrontendCategoryToCode = (category: DailyExpense['category']): string => {
  switch (category) {
    case 'NCC_CESS':
      return 'NCC_CESS';
    case 'WATCHMAN':
      return 'WATCHMAN';
    case 'CLEANER':
    case 'SWEEPING_AND_SANITATION':
      return 'CLEANERS_SWEEPERS';
    case 'TRANSPORT':
      return 'TRANSPORT';
    case 'CASUAL_LABOR':
      return 'CASUAL_LABOR';
    default:
      return 'OTHER';
  }
};

const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function formatReadableBatchNumber(origin: string, onionType?: string, date = new Date()): string {
  const originPart =
    origin
      .split(',')[0]
      .split('(')[0]
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 10) || 'BATCH';
  const dd = String(date.getDate()).padStart(2, '0');
  const mmm = MONTHS_SHORT[date.getMonth()] || 'JAN';
  const yy = String(date.getFullYear()).slice(-2);
  const datePart = `${dd}${mmm}${yy}`;
  const typePart =
    (onionType || 'ONION')
      .replace(/\s*\(Grade\s*[12]\)\s*$/i, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 10) || 'ONION';
  return `${originPart}-${datePart}-${typePart}`;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      role: 'MERCHANT',
      currentUserId: '',
      currentUserName: '',
      masterName: 'Master',
      getMasterName: () => get().masterName || 'Master',
      storeName: 'Onion Store',
      currentUserPhone: '',
      currentUserNationalId: '',
      isAuthenticated: false,
      isSyncing: false,

      isLockedDown: false,
      currentBatch: null,
      historicalBatches: [],
      allocations: [],
      sales: [],
      expenses: [],
      expenseCategories: [],
      casualLaborers: [],
      customerCredits: [],
      creditRepayments: [],
      reconciliations: [],
      batchProducts: [],
      activityLogs: [],
      stockDiscrepancyAlerts: [],

      isDarkMode: false,
      toggleTheme: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
      isPrivacyMode: false,
      togglePrivacyMode: () => set((s) => ({ isPrivacyMode: !s.isPrivacyMode })),
      acceptedPaymentModes: { CASH: true, MPESA: true, CREDIT: true },
      togglePaymentMode: (mode) =>
        set((s) => {
          const current = s.acceptedPaymentModes || { CASH: true, MPESA: true, CREDIT: true };
          const nextValue = !current[mode];
          const activeCount = Object.values(current).filter(Boolean).length;
          if (!nextValue && activeCount <= 1) {
            return s;
          }
          return {
            acceptedPaymentModes: {
              ...current,
              [mode]: nextValue,
            },
          };
        }),

      merchantPolicyAccepted: false,
      sellerPolicyAccepted: false,
      acceptPolicy: async (role) => {
        try {
          await apiFetch('/me/terms-acceptance', {
            method: 'POST',
            body: { termsVersion: 'v1' },
          });
          const now = new Date().toISOString();
          if (role === 'MERCHANT') {
            set({ merchantPolicyAccepted: true, merchantPolicyAcceptedAt: now });
          } else {
            set({ sellerPolicyAccepted: true, sellerPolicyAcceptedAt: now });
          }
        } catch {
          // ignore if offline
        }
      },

      syncFromServer: (() => {
        let inFlightSync: Promise<boolean> | null = null;
        return async () => {
          if (inFlightSync) return inFlightSync;
          inFlightSync = (async () => {
            set({ isSyncing: true, lastSyncError: undefined });
            try {
              const payload = await apiFetch<BackendSyncPayload>('/sync');
              const mapped = mapSyncPayloadToStore(payload);
              const prevSelectedId = get().currentBatch?.id;
              const allMapped = [mapped.currentBatch, ...mapped.historicalBatches].filter(
                (b): b is TruckBatch => Boolean(b)
              );
              const preserved = prevSelectedId
                ? allMapped.find((b) => b.id === prevSelectedId && b.status === 'ACTIVE')
                : undefined;
              const nextCurrentBatch = preserved ?? mapped.currentBatch;
              const nextHistoricalBatches = nextCurrentBatch
                ? allMapped.filter((b) => b.id !== nextCurrentBatch.id)
                : mapped.historicalBatches;
              set({
                ...mapped,
                currentBatch: nextCurrentBatch,
                historicalBatches: nextHistoricalBatches,
                isAuthenticated: true,
                isSyncing: false,
                lastSyncError: undefined,
              });
              return true;
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Sync failed';
              set({ isSyncing: false, lastSyncError: msg });
              if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
                await sellerTokenStorage.clear();
                set({ isAuthenticated: false });
              }
              return false;
            } finally {
              inFlightSync = null;
            }
          })();
          return inFlightSync;
        };
      })(),

      syncMasterWithClerk: async (profile) => {
        try {
          await apiFetch('/auth/master/sync', {
            method: 'POST',
            body: profile ?? {},
          });
          await get().syncFromServer();
          return { success: true, message: 'Authenticated with Clerk & synced.' };
        } catch (err) {
          return {
            success: false,
            message: err instanceof Error ? err.message : 'Master sync failed',
          };
        }
      },

      restoreSellerSession: async () => {
        const tokens = await sellerTokenStorage.get();
        if (!tokens) return false;
        return get().syncFromServer();
      },

      requestSellerOtp: async (phone, purpose = 'LOGIN') => {
        try {
          const res = await apiFetch<{ ok: boolean; message: string }>(
            '/auth/seller/otp/request',
            {
              method: 'POST',
              body: { phoneE164: phone, purpose },
              skipAuth: true,
            }
          );
          return { success: true, message: res.message };
        } catch (err) {
          return {
            success: false,
            message: err instanceof Error ? err.message : 'Failed to request OTP',
          };
        }
      },

      generateSellerInviteCode: async (phone) => {
        try {
          const res = await apiFetch<{
            ok: boolean;
            code: string;
            expiresAt: string;
          }>('/auth/seller/invite-code', {
            method: 'POST',
            body: { phoneE164: phone },
          });
          return { success: true, code: res.code, expiresAt: res.expiresAt };
        } catch (err) {
          return {
            success: false,
            message: err instanceof Error ? err.message : 'Failed to generate login code',
          };
        }
      },

      verifySellerOtp: async (phone, otp, passphrase, purpose = 'LOGIN') => {
        try {
          const fp = await getOrCreateDeviceFingerprint();
          const res = await apiFetch<{
            accessToken: string;
            refreshToken: string;
            deviceId: string;
            seller: { fullName: string };
          }>('/auth/seller/otp/verify', {
            method: 'POST',
            body: {
              phoneE164: phone,
              code: otp,
              purpose,
              deviceFingerprint: fp,
              passphrase: passphrase || undefined,
            },
            skipAuth: true,
          });
          await sellerTokenStorage.set({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            deviceId: res.deviceId,
            deviceFingerprint: fp,
          });
          await get().syncFromServer();
          return {
            success: true,
            message: 'Verified and logged in',
            sellerName: res.seller.fullName,
          };
        } catch (err) {
          return {
            success: false,
            message: err instanceof Error ? err.message : 'OTP verification failed',
          };
        }
      },

      loginSellerWithPassphrase: async (phone, passphrase) => {
        try {
          const fp = await getOrCreateDeviceFingerprint();
          const res = await apiFetch<{
            accessToken: string;
            refreshToken: string;
            deviceId: string;
            seller: { fullName: string };
          }>('/auth/seller/passphrase/login', {
            method: 'POST',
            body: {
              phoneE164: phone,
              passphrase,
              deviceFingerprint: fp,
            },
            skipAuth: true,
          });
          await sellerTokenStorage.set({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            deviceId: res.deviceId,
            deviceFingerprint: fp,
          });
          await get().syncFromServer();
          return {
            success: true,
            message: 'Logged in',
            sellerName: res.seller.fullName,
          };
        } catch (err) {
          return {
            success: false,
            message: err instanceof Error ? err.message : 'Login failed',
          };
        }
      },

      logout: async () => {
        try {
          await apiFetch('/auth/logout', { method: 'POST' });
        } catch {
          // ignore
        }
        await sellerTokenStorage.clear();
        set({
          isAuthenticated: false,
          currentUserId: '',
          currentUserName: '',
          currentBatch: null,
          historicalBatches: [],
          allocations: [],
          sales: [],
          expenses: [],
          customerCredits: [],
          reconciliations: [],
          batchProducts: [],
        });
      },

      lockdown: async (reason) => {
        await apiFetch('/security/lockdown', {
          method: 'POST',
          body: { reason },
        });
        await get().syncFromServer();
      },

      unlock: async () => {
        try {
          await apiFetch('/security/unlockdown', { method: 'POST', body: {} });
          await get().syncFromServer();
          return { success: true, message: 'System unlocked' };
        } catch (err) {
          return {
            success: false,
            message: err instanceof Error ? err.message : 'Unlock failed',
          };
        }
      },

      setRole: (role) => set({ role }),
      setUserName: (name) => set({ currentUserName: name }),
      setStoreName: (name) => set({ storeName: name }),
      setUserPhone: (phone) => set({ currentUserPhone: phone }),
      setUserNationalId: (id) => set({ currentUserNationalId: id }),

      updateMasterProfile: async (params) => {
        await apiFetch('/me/config', {
          method: 'PATCH',
          body: { storeName: params.storeName },
        });
        await apiFetch('/auth/master/sync', {
          method: 'POST',
          body: {
            fullName: params.adminName,
            storeName: params.storeName,
            phoneE164: params.phone,
            nationalId: params.nationalId,
          },
        });
        await get().syncFromServer();
      },

      updateBatchPurchaseCosts: async (costs) => {
        const batch = get().currentBatch;
        if (!batch) return;
        await apiFetch(`/batches/${batch.id}/purchase-costs`, {
          method: 'PATCH',
          body: { purchaseCosts: { ...(batch.purchaseCosts ?? {}), ...costs } },
        });
        await get().syncFromServer();
      },

      setBatchDay: () => {
        // Server cron manages dayNumber; kept as no-op for UI compatibility
      },

      selectActiveBatch: (batchId) => {
        const state = get();
        const all = [state.currentBatch, ...state.historicalBatches].filter(
          (b): b is TruckBatch => Boolean(b)
        );
        const target = all.find((b) => b.id === batchId);
        if (!target) return;
        const others = all.filter((b) => b.id !== batchId);
        set({ currentBatch: target, historicalBatches: others });
      },

      createBatch: async (params) => {
        const pkgGrams = 20000;
        const g1Grams = Math.round(params.initialGrade1Nets * pkgGrams);
        const g2Grams = Math.round(params.initialGrade2Nets * pkgGrams);
        const netsLoaded = Math.round(params.initialGrade1Nets + params.initialGrade2Nets);
        const res = await apiFetch<{ batch: { id: string } }>('/batches', {
          method: 'POST',
          idempotent: true,
          body: {
            batchNumber: formatReadableBatchNumber(
              params.origin.specificLocation || params.origin.regionName,
              params.qualityNotes?.split(/\s+/).slice(0, 2).join('') || 'ONION'
            ),
            truckPlate: params.truckPlate,
            originRegionId: params.origin.regionId,
            originRegionName: params.origin.regionName,
            originSpecificLocation: params.origin.specificLocation,
            farmerSupplierNotes: params.origin.farmerSupplierNotes,
            packagingGrams: pkgGrams,
            netsLoaded,
            initialGrade1NominalGrams: g1Grams,
            initialGrade2NominalGrams: g2Grams,
            nccCountedNets: params.nccDeclaredNets,
            nccOfficialAmountCents: Math.round(params.nccCessPaid * 100),
            isNccCessPaid: true,
            photoUrls: params.photoUrls,
            qualityNotes: params.qualityNotes,
          },
        });
        const regionLabel = params.origin.regionName.split('(')[0].trim() || 'Market Onion';
        const productJobs: Promise<unknown>[] = [];
        if (params.initialGrade1Nets > 0) {
          productJobs.push(
            apiFetch(`/batches/${res.batch.id}/products`, {
              method: 'POST',
              body: {
                title: `${regionLabel} Grade 1`,
                grade: 'GRADE_1',
                packaging: '20KG_NET',
                weightGrams: pkgGrams,
                priceCents: 130000,
                minPriceCents: 115000,
                photoUrls: params.photoUrls ?? [],
                description: params.qualityNotes || `Grade 1 stock from ${params.origin.regionName}`,
                tags: ['New Stock', 'Grade 1'],
              },
            })
          );
        }
        if (params.initialGrade2Nets > 0) {
          productJobs.push(
            apiFetch(`/batches/${res.batch.id}/products`, {
              method: 'POST',
              body: {
                title: `${regionLabel} Grade 2`,
                grade: 'GRADE_2',
                packaging: '20KG_NET',
                weightGrams: pkgGrams,
                priceCents: 100000,
                minPriceCents: 90000,
                photoUrls: params.photoUrls ?? [],
                description: params.qualityNotes || `Grade 2 stock from ${params.origin.regionName}`,
                tags: ['New Stock', 'Grade 2'],
              },
            })
          );
        }
        if (productJobs.length > 0) {
          await Promise.all(productJobs);
        }
        await get().syncFromServer();
      },

      advanceBatchDay: async () => {
        await get().syncFromServer();
      },

      closeCurrentBatch: async () => {
        const batch = get().currentBatch;
        if (!batch) return;
        await apiFetch(`/batches/${batch.id}/close`, { method: 'POST', body: {} });
        await get().syncFromServer();
      },

      addBatchPhoto: () => {
        // Photo upload placeholder
      },

      addBatchProduct: async (product) => {
        const batch = get().currentBatch;
        if (!batch) return;
        await apiFetch(`/batches/${batch.id}/products`, {
          method: 'POST',
          body: {
            title: product.title,
            grade: product.grade,
            packaging: product.packaging,
            weightGrams: Math.round(product.weightKg * 1000),
            priceCents: Math.round(product.pricePerBag * 100),
            minPriceCents: Math.round((product.minPrice ?? product.pricePerBag) * 100),
            photoUrl: product.photoUrl,
            photoUrls: product.photoUrls ?? [],
            description: product.description,
            tags: product.tags ?? [],
          },
        });
        await get().syncFromServer();
      },

      deleteBatchProduct: async (productId) => {
        await apiFetch(`/products/${productId}`, { method: 'DELETE' });
        await get().syncFromServer();
      },

      updateBatchDetails: async (params) => {
        const batch = get().currentBatch;
        if (!batch) return;
        await apiFetch(`/batches/${batch.id}`, {
          method: 'PATCH',
          body: params,
        });
        await get().syncFromServer();
      },

      updateBatchProduct: async (productId, params) => {
        await apiFetch(`/products/${productId}`, {
          method: 'PATCH',
          body: {
            title: params.title,
            packaging: params.packaging,
            weightGrams: params.weightKg ? Math.round(params.weightKg * 1000) : undefined,
            priceCents: params.pricePerBag ? Math.round(params.pricePerBag * 100) : undefined,
            minPriceCents: params.minPrice ? Math.round(params.minPrice * 100) : undefined,
            description: params.description,
          },
        });
        await get().syncFromServer();
      },

      updateBatchPricing: async (params) => {
        const batch = get().currentBatch;
        if (!batch) return;
        await apiFetch(`/batches/${batch.id}/pricing`, {
          method: 'PATCH',
          body: {
            priceG1Cents: params.pricePerBagGrade1
              ? Math.round(params.pricePerBagGrade1 * 100)
              : undefined,
            minPriceG1Cents: params.minPriceGrade1
              ? Math.round(params.minPriceGrade1 * 100)
              : undefined,
            priceG2Cents: params.pricePerBagGrade2
              ? Math.round(params.pricePerBagGrade2 * 100)
              : undefined,
            minPriceG2Cents: params.minPriceGrade2
              ? Math.round(params.minPriceGrade2 * 100)
              : undefined,
          },
        });
        await get().syncFromServer();
      },

      createProductAndBatch: async (params) => {
        const pkgGrams = Math.round((params.packagingKg || 20) * 1000);
        const g1Grams = Math.round(params.stockGrade1 * pkgGrams);
        const g2Grams = Math.round((params.stockGrade2 ?? 0) * pkgGrams);
        const netsLoaded = Math.round(params.stockGrade1 + (params.stockGrade2 ?? 0));

        const res = await apiFetch<{ batch: { id: string } }>('/batches', {
          method: 'POST',
          idempotent: true,
          body: {
            batchNumber: formatReadableBatchNumber(params.origin, params.title),
            truckPlate: params.truckPlate,
            originRegionName: params.origin,
            packagingGrams: pkgGrams,
            netsLoaded,
            initialGrade1NominalGrams: g1Grams,
            initialGrade2NominalGrams: g2Grams,
            nccCountedNets: netsLoaded,
            priceG1Cents: Math.round(params.priceGrade1 * 100),
            minPriceG1Cents: Math.round(params.minPriceGrade1 * 100),
            priceG2Cents: params.priceGrade2 ? Math.round(params.priceGrade2 * 100) : undefined,
            minPriceG2Cents: params.minPriceGrade2
              ? Math.round(params.minPriceGrade2 * 100)
              : undefined,
            photoUrls: params.photoUrls ?? [],
            qualityNotes: params.description,
          },
        });

        const packagingCode = `${Math.round(params.packagingKg || 20)}KG_NET`;
        const primaryPhotoUrl = params.photoUrls?.[0];
        const productCreates: Promise<unknown>[] = [
          apiFetch(`/batches/${res.batch.id}/products`, {
            method: 'POST',
            body: {
              title: params.title,
              grade: 'GRADE_1',
              packaging: packagingCode,
              weightGrams: pkgGrams,
              priceCents: Math.round(params.priceGrade1 * 100),
              minPriceCents: Math.round(params.minPriceGrade1 * 100),
              photoUrl: primaryPhotoUrl,
              photoUrls: params.photoUrls ?? [],
              description: params.description,
              tags: params.tags ?? [],
            },
          }),
        ];
        if (
          params.hasGrade2 &&
          (params.stockGrade2 ?? 0) > 0 &&
          (params.priceGrade2 ?? 0) > 0
        ) {
          const g2WeightKg = params.weightKgGrade2 && params.weightKgGrade2 > 0
            ? params.weightKgGrade2
            : params.packagingKg || 20;
          const g2PackagingCode = `${Math.round(g2WeightKg)}KG_NET`;
          const g2BaseTags = (params.tags ?? []).filter(
            (t) => t !== 'Grade 1' && t !== 'Large Size' && t !== 'Medium Size' && t !== 'Small Size'
          );
          const g2Tags = [
            'Grade 2',
            ...(params.sizesGrade2 ?? []),
            ...g2BaseTags,
          ];
          const g2Photos =
            params.photoUrlsGrade2 && params.photoUrlsGrade2.length > 0
              ? params.photoUrlsGrade2
              : params.photoUrls ?? [];
          productCreates.push(
            apiFetch(`/batches/${res.batch.id}/products`, {
              method: 'POST',
              body: {
                title: params.title,
                grade: 'GRADE_2',
                packaging: g2PackagingCode,
                weightGrams: Math.round(g2WeightKg * 1000),
                priceCents: Math.round((params.priceGrade2 ?? 0) * 100),
                minPriceCents: Math.round(
                  (params.minPriceGrade2 ?? params.priceGrade2 ?? 0) * 100
                ),
                photoUrl: g2Photos[0],
                photoUrls: g2Photos,
                description: params.descriptionGrade2?.trim() || params.description,
                tags: g2Tags,
              },
            })
          );
        }
        await Promise.all(productCreates);
        await get().syncFromServer();
      },

      allocateStockToSeller: async (params) => {
        const batch = get().currentBatch;
        if (!batch) return {};
        const pkgGrams = (batch.packagingKg ?? 20) * 1000;
        await apiFetch('/assignments', {
          method: 'POST',
          idempotent: true,
          body: {
            phoneE164: params.sellerPhone,
            fullName: params.sellerName,
            nationalId: params.sellerNationalId,
            batchId: batch.id,
            grade1NominalGrams: Math.round(params.grade1Allocated * pkgGrams),
            grade2NominalGrams: Math.round(params.grade2Allocated * pkgGrams),
            expectedPriceG1Cents: Math.round(params.expectedPriceG1 * 100),
            expectedPriceG2Cents: Math.round(params.expectedPriceG2 * 100),
          },
        });
        await get().syncFromServer();
        const invite = await get().generateSellerInviteCode(params.sellerPhone);
        return { inviteCode: invite.code };
      },

      updateSellerNationalId: async (sellerId, nationalId) => {
        await apiFetch(`/salespeople/${sellerId}`, {
          method: 'PATCH',
          body: { nationalId },
        });
        await get().syncFromServer();
      },

      toggleNccCessPayment: async () => {
        const batch = get().currentBatch;
        if (!batch) return;
        await apiFetch(`/batches/${batch.id}/ncc-paid`, { method: 'POST', body: {} });
        await get().syncFromServer();
      },

      toggleExpensePaid: async (categoryOrId) => {
        const exp = get().expenses.find(
          (e) => e.id === categoryOrId || e.category === categoryOrId
        );
        if (!exp) return;
        await apiFetch(`/expenses/${exp.id}/toggle-paid`, { method: 'POST', body: {} });
        await get().syncFromServer();
      },

      recordSale: async (params) => {
        const state = get();
        const batch = state.currentBatch;
        if (!batch) {
          return { success: false, message: 'No active batch found.' };
        }
        const pkgGrams = (batch.packagingKg ?? 20) * 1000;
        const qtyNominalGrams = Math.round(params.quantityNets * pkgGrams);
        const weighedGrams = params.weighedGrams ?? qtyNominalGrams;

        const myAssignment =
          state.role === 'SELLER'
            ? state.allocations.find((a) => a.batchId === batch.id)
            : undefined;

        try {
          const res = await apiFetch<{
            sale: { status: string; totalAmountCents: number };
          }>('/sales', {
            method: 'POST',
            idempotent: true,
            body: {
              batchId: batch.id,
              assignmentId: myAssignment?.id,
              grade: params.grade,
              pricingMode: params.pricingMode ?? 'PER_NET',
              quantityNominalGrams: qtyNominalGrams,
              weighedGrams,
              unitPricePerNetCents: Math.round(params.negotiatedUnitPrice * 100),
              paymentMode: params.paymentMethod,
              mpesaReceipt: params.mpesaReceiptCode,
              payerPhoneE164: params.buyerPhone,
              buyerName: params.buyerName,
              guarantorAccepted: params.guarantorAccepted ?? true,
              buyer:
                params.paymentMethod === 'CREDIT' &&
                params.buyerName &&
                params.buyerPhone &&
                params.buyerNationalId
                  ? {
                      fullName: params.buyerName,
                      phoneE164: params.buyerPhone,
                      nationalId: params.buyerNationalId,
                      marketingConsent: params.buyerConsentConfirmed ?? false,
                    }
                  : undefined,
            },
          });
          await get().syncFromServer();
          const ksh = Math.round(res.sale.totalAmountCents / 100);
          return {
            success: true,
            message:
              res.sale.status === 'PENDING_APPROVAL'
                ? `Sale submitted for Master approval (KSh ${ksh.toLocaleString()}).`
                : `Sale recorded: KSh ${ksh.toLocaleString()}.`,
          };
        } catch (err) {
          return {
            success: false,
            message: err instanceof Error ? err.message : 'Failed to record sale',
          };
        }
      },

      approveCreditSale: async (creditEntryId) => {
        await apiFetch(`/credit-entries/${creditEntryId}/approve`, { method: 'POST', body: {} });
        await get().syncFromServer();
      },

      rejectCreditSale: async (creditEntryId) => {
        await apiFetch(`/credit-entries/${creditEntryId}/reject`, { method: 'POST', body: {} });
        await get().syncFromServer();
      },

      recordCreditRepayment: async (params) => {
        await apiFetch(`/credit-entries/${params.creditEntryId}/repayments`, {
          method: 'POST',
          idempotent: true,
          body: {
            method: params.paymentMethod,
            amountCents: Math.round(params.amount * 100),
            mpesaReceipt: params.mpesaReceiptCode,
            payerPhoneE164: params.payerPhone,
          },
        });
        await get().syncFromServer();
      },

      addDailyExpense: async (params) => {
        const state = get();
        const batchId = params.batchId || state.currentBatch?.id;
        if (!batchId) return;
        const code = mapFrontendCategoryToCode(params.category);
        const cat =
          state.expenseCategories.find((c) => c.code === code) ?? state.expenseCategories[0];
        if (!cat) return;
        await apiFetch(`/batches/${batchId}/expenses`, {
          method: 'POST',
          body: {
            categoryId: cat.id,
            description: params.description,
            amountCents: Math.round(params.amount * 100),
            paidVia: params.paidVia,
            receiptRef: params.receiptRef,
            isPaid: true,
          },
        });
        await get().syncFromServer();
      },

      addCasualLaborer: async (params) => {
        const batchId = params.batchId || get().currentBatch?.id;
        if (!batchId) return;
        await apiFetch(`/batches/${batchId}/laborers`, {
          method: 'POST',
          body: {
            workerName: params.workerName,
            task: params.task,
            agreedWageCents: Math.round(params.agreedWage * 100),
          },
        });
        await get().syncFromServer();
      },

      markLaborerPaid: async (laborerId, paidVia) => {
        await apiFetch(`/laborers/${laborerId}/pay`, {
          method: 'POST',
          body: { paidVia },
        });
        await get().syncFromServer();
      },

      performCobReconciliation: async (params) => {
        const state = get();
        const batch = state.currentBatch;
        if (!batch) return null;
        const pkgGrams = (batch.packagingKg ?? 20) * 1000;
        const myAssignment =
          state.role === 'SELLER'
            ? state.allocations.find((a) => a.batchId === batch.id)
            : undefined;
        await apiFetch('/reconciliations', {
          method: 'POST',
          body: {
            batchId: batch.id,
            assignmentId: myAssignment?.id ?? null,
            physicalG1NominalGrams: Math.round(params.physicalCountGrade1 * pkgGrams),
            physicalG2NominalGrams: Math.round(params.physicalCountGrade2 * pkgGrams),
            actualCashCents: Math.round(params.actualCashInHand * 100),
            notes: params.notes,
          },
        });
        await get().syncFromServer();
        return get().reconciliations[0] ?? null;
      },

      approveDailyReconciliation: async (reconciliationId) => {
        await apiFetch(`/reconciliations/${reconciliationId}/approve`, {
          method: 'POST',
          body: {},
        });
        await get().syncFromServer();
      },

      acknowledgeStockAllocation: async (allocationId) => {
        await apiFetch(`/assignments/${allocationId}/acknowledge`, { method: 'POST', body: {} });
        await get().syncFromServer();
      },

      reportStockDiscrepancy: async (allocationId, params) => {
        const batch = get().currentBatch;
        const pkgGrams = (batch?.packagingKg ?? 20) * 1000;
        await apiFetch(`/assignments/${allocationId}/discrepancy`, {
          method: 'POST',
          body: {
            physicalG1NominalGrams: Math.round(params.physicalG1 * pkgGrams),
            physicalG2NominalGrams: Math.round(params.physicalG2 * pkgGrams),
            note: params.note,
          },
        });
        await get().syncFromServer();
      },

      resolveStockDiscrepancy: async (alertId) => {
        await apiFetch(`/discrepancy-alerts/${alertId}/resolve`, { method: 'POST', body: {} });
        await get().syncFromServer();
      },

      resetToSampleData: async () => {
        await get().syncFromServer();
      },
    }),
    {
      name: 'thegem-ui-prefs-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        isPrivacyMode: state.isPrivacyMode,
      }),
    }
  )
);
