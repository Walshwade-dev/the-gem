// ============================================================================
// The Gem: Credited Persons & Debtor Governance View
// Grouped by Batch & Date, multi-filtering (Date issued, Payment status,
// Person liable, and In-House Credit Score rating).
// Enforces ISMS & QMS separation of concerns based on user role:
// Salesperson only sees credit records they offered during their sales sessions.
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';
import { useAppStore } from '../../store/useAppStore';
import { CreditEntry, CustomerCredit, InHouseCreditRating } from '../../types';
import { maskPhoneNumber } from '../../services/security';

interface CreditRecordsViewProps {
  isDarkMode?: boolean;
}

export const CreditRecordsView: React.FC<CreditRecordsViewProps> = ({
  isDarkMode = false,
}) => {
  const {
    customerCredits,
    role,
    currentUserName,
    masterName,
    recordCreditRepayment,
    approveCreditSale,
    rejectCreditSale,
  } = useAppStore();

  const effectiveMaster = masterName || (role === 'MERCHANT' ? currentUserName : '') || 'Master';

  // Filters State
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'PAST_3' | 'PAST_7'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [scoreFilter, setScoreFilter] = useState<'ALL' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'HIGH_RISK'>('ALL');
  const [sellerFilter, setSellerFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active filters count
  const activeFiltersCount =
    (statusFilter !== 'ALL' ? 1 : 0) +
    (scoreFilter !== 'ALL' ? 1 : 0) +
    (dateFilter !== 'ALL' ? 1 : 0) +
    (sellerFilter !== 'ALL' ? 1 : 0);

  const resetFilters = () => {
    setStatusFilter('ALL');
    setScoreFilter('ALL');
    setDateFilter('ALL');
    setSellerFilter('ALL');
    setSearchQuery('');
  };

  // Per-record accordion expansion state (default collapsed for cleaner display)
  const [expandedRecordIds, setExpandedRecordIds] = useState<Record<string, boolean>>({});
  // ISMS & QMS Policy / SOP Banner (Minimized by default, user clicks to activate, closes on toggle)
  const [showIsmsPolicy, setShowIsmsPolicy] = useState(false);

  const toggleRecordExpand = (id: string) => {
    setExpandedRecordIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Repayment Modal State
  const [payingCustomerId, setPayingCustomerId] = useState<string | null>(null);
  const [payingEntryId, setPayingEntryId] = useState<string | null>(null);
  const [repayAmount, setRepayAmount] = useState<string>('');
  const [repayMethod, setRepayMethod] = useState<'CASH' | 'MPESA'>('MPESA');
  const [mpesaRef, setMpesaRef] = useState<string>('');

  const todayStr = new Date().toISOString().split('T')[0];

  // Flatten all credit records with customer profile context
  interface FlattenedCreditRecord extends CreditEntry {
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerNationalId?: string;
    customerCreditScore: number;
    customerCreditRating: InHouseCreditRating;
  }

  const allRecords: FlattenedCreditRecord[] = useMemo(() => {
    const list: FlattenedCreditRecord[] = [];
    customerCredits.forEach((cust) => {
      cust.records.forEach((rec) => {
        list.push({
          ...rec,
          customerId: cust.id,
          customerName: cust.customerName,
          customerPhone: cust.customerPhone,
          customerNationalId: cust.customerNationalId || rec.buyerNationalId,
          customerCreditScore: rec.creditScore || cust.creditScore || 75,
          customerCreditRating: rec.creditRating || cust.creditRating || 'GOOD',
        });
      });
    });
    return list;
  }, [customerCredits]);

  // ISMS & QMS Role-based filtering:
  // For SELLER: strictly only show records relating to today's sales session OR
  // previously assigned stocks that have NOT yet been paid (active outstanding receivables).
  const roleFilteredRecords = useMemo(() => {
    if (role === 'SELLER') {
      const normalizedCurrentName = (currentUserName || '').toLowerCase().trim();
      return allRecords.filter((r) => {
        const liable = (r.personLiable || r.sellerName || r.authorizedBy || '').toLowerCase();
        const matchesSeller =
          liable.includes(normalizedCurrentName) ||
          (normalizedCurrentName.includes('juma') && liable.includes('juma')) ||
          (normalizedCurrentName.includes('ali') && liable.includes('ali'));
        if (!matchesSeller) return false;

        const isToday = r.dateIssued === todayStr;
        const isUnpaid = r.totalOwed > r.amountPaid;
        // Only show records for current day or unpaid previous debts
        return isToday || isUnpaid;
      });
    }
    return allRecords;
  }, [allRecords, role, currentUserName, todayStr]);

  // Extract distinct sellers for filter chips (Master view only)
  const distinctSellers = useMemo(() => {
    const set = new Set<string>();
    allRecords.forEach((r) => {
      if (r.personLiable) set.add(r.personLiable);
      else if (r.sellerName) set.add(r.sellerName);
      else if (r.authorizedBy) set.add(r.authorizedBy);
    });
    return Array.from(set);
  }, [allRecords]);

  // Apply user interactive filters
  const filteredRecords = useMemo(() => {
    return roleFilteredRecords.filter((rec) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = rec.customerName.toLowerCase().includes(q);
        const matchesPhone = rec.customerPhone.includes(q);
        const matchesId = (rec.customerNationalId || '').includes(q);
        const matchesTruck = rec.truckPlate.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesId && !matchesTruck) return false;
      }

      // Date Filter
      if (dateFilter === 'TODAY' && rec.dateIssued !== todayStr) return false;
      if (dateFilter === 'PAST_3') {
        const diffDays = (new Date(todayStr).getTime() - new Date(rec.dateIssued).getTime()) / (1000 * 3600 * 24);
        if (diffDays > 3) return false;
      }
      if (dateFilter === 'PAST_7') {
        const diffDays = (new Date(todayStr).getTime() - new Date(rec.dateIssued).getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      }

      // Status Filter
      const balance = rec.totalOwed - rec.amountPaid;
      if (statusFilter === 'PENDING' && balance <= 0) return false;
      if (statusFilter === 'PAID' && balance > 0) return false;

      // Score Filter
      if (scoreFilter !== 'ALL' && rec.customerCreditRating !== scoreFilter) return false;

      // Person Liable Filter (Master only)
      if (role === 'MERCHANT' && sellerFilter !== 'ALL') {
        const liable = rec.personLiable || rec.sellerName || rec.authorizedBy || '';
        if (liable !== sellerFilter) return false;
      }

      return true;
    });
  }, [roleFilteredRecords, searchQuery, dateFilter, statusFilter, scoreFilter, sellerFilter, todayStr, role]);

  // Group filtered records by Batch and then Date
  const groupedByBatchAndDate = useMemo(() => {
    const groups: {
      batchKey: string;
      batchNumber: string;
      truckPlate: string;
      dateIssued: string;
      records: FlattenedCreditRecord[];
      batchTotalOwed: number;
      batchTotalOutstanding: number;
    }[] = [];

    filteredRecords.forEach((rec) => {
      const batchNumber = rec.batchNumber || rec.batchId || 'WB-CURRENT';
      const key = `${batchNumber}__${rec.truckPlate}__${rec.dateIssued}`;

      let group = groups.find((g) => g.batchKey === key);
      if (!group) {
        group = {
          batchKey: key,
          batchNumber,
          truckPlate: rec.truckPlate,
          dateIssued: rec.dateIssued,
          records: [],
          batchTotalOwed: 0,
          batchTotalOutstanding: 0,
        };
        groups.push(group);
      }

      group.records.push(rec);
      group.batchTotalOwed += rec.totalOwed;
      group.batchTotalOutstanding += rec.totalOwed - rec.amountPaid;
    });

    return groups;
  }, [filteredRecords]);

  // Summary Metrics
  const totalOutstanding = filteredRecords.reduce((sum, r) => sum + (r.totalOwed - r.amountPaid), 0);
  const pendingApprovalsCount = filteredRecords.filter((r) => r.approvalStatus === 'PENDING').length;
  const highRiskDebt = filteredRecords
    .filter((r) => r.customerCreditRating === 'HIGH_RISK')
    .reduce((sum, r) => sum + (r.totalOwed - r.amountPaid), 0);

  // Repayment handlers
  const handleOpenRepayment = (customerId: string, entryId: string, currentBalance: number) => {
    setPayingCustomerId(customerId);
    setPayingEntryId(entryId);
    setRepayAmount(String(currentBalance));
  };

  const handleConfirmRepayment = () => {
    const amount = parseFloat(repayAmount) || 0;
    if (amount <= 0 || !payingCustomerId || !payingEntryId) {
      Alert.alert('Invalid Amount', 'Please enter a valid repayment amount.');
      return;
    }

    recordCreditRepayment({
      customerId: payingCustomerId,
      creditEntryId: payingEntryId,
      amount,
      paymentMethod: repayMethod,
      mpesaReceiptCode: mpesaRef.trim() || undefined,
    });

    Alert.alert(
      '✅ Repayment Recorded',
      `Ksh ${amount.toLocaleString()} received via ${repayMethod} towards credit debt.`
    );

    setPayingCustomerId(null);
    setPayingEntryId(null);
    setRepayAmount('');
    setMpesaRef('');
  };

  const handleApproveCredit = (entryId: string, name: string, amount: number) => {
    approveCreditSale(entryId);
    Alert.alert('✅ Credit Approved', `Master sign-off confirmed for ${name} (Ksh ${amount.toLocaleString()}).`);
  };

  const handleRejectCredit = (entryId: string, name: string, amount: number) => {
    Alert.alert(
      'Reject Credit Sale?',
      `Are you sure you want to reject credit for ${name} (Ksh ${amount.toLocaleString()})? The reserved sacks will be restored to bay stock.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject & Restock',
          style: 'destructive',
          onPress: () => {
            rejectCreditSale(entryId);
            Alert.alert('Credit Sale Rejected', 'Request cancelled and stock restored to inventory.');
          },
        },
      ]
    );
  };

  const getScoreBadgeColor = (rating: InHouseCreditRating) => {
    switch (rating) {
      case 'EXCELLENT':
        return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0', label: 'A+ Prompt' };
      case 'GOOD':
        return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', label: 'B Reliable' };
      case 'FAIR':
        return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', label: 'C Fair' };
      case 'HIGH_RISK':
        return { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', label: '⚠️ High Risk' };
    }
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* ISMS / QMS Policy & SOP Bar (Minimized by Default) */}
      <TouchableOpacity
        style={[styles.minimizedPolicyBar, isDarkMode && styles.minimizedPolicyBarDark]}
        onPress={() => setShowIsmsPolicy((prev) => !prev)}
        activeOpacity={0.7}
      >
        <View style={styles.minimizedPolicyLeft}>
          <Ionicons
            name={role === 'SELLER' ? 'shield-checkmark' : 'shield-half'}
            size={14}
            color={isDarkMode ? '#CFE9EC' : (role === 'SELLER' ? '#059669' : '#0891B2')}
          />
          <Text style={[styles.minimizedPolicyText, isDarkMode && { color: '#F0FDFA' }]}>
            {role === 'SELLER'
              ? 'ISMS & QMS SOP: Role Isolation Active'
              : 'ISMS & QMS Policy: Master Credit Governance'}
          </Text>
        </View>
        <Text style={[styles.minimizedPolicyToggleText, isDarkMode && { color: '#CFE9EC' }]}>
          {showIsmsPolicy ? 'Minimize ▴' : 'View SOP / Policy ▾'}
        </Text>
      </TouchableOpacity>

      {/* Expanded ISMS / QMS Policy & SOP Banner */}
      {showIsmsPolicy && (
        <View>
          {role === 'SELLER' ? (
            <View style={styles.ismsBannerSeller}>
              <Ionicons name="shield-checkmark" size={16} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={styles.ismsBannerSellerTitle}>
                  ISMS & QMS ROLE ISOLATION SOP ACTIVE
                </Text>
                <Text style={styles.ismsBannerSellerText}>
                  Displaying solely debtor accounts and credit transactions issued during your assigned sales sessions.
                </Text>
                <TouchableOpacity
                  style={styles.closeIsmsBtn}
                  onPress={() => setShowIsmsPolicy(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.closeIsmsBtnText}>Close / Minimize SOP ▴</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.ismsBannerMaster}>
              <Ionicons name="shield-half" size={16} color="#0891B2" />
              <View style={{ flex: 1 }}>
                <Text style={styles.ismsBannerMasterTitle}>
                  MASTER AUDIT & CREDITED PERSONS GOVERNANCE POLICY
                </Text>
                <Text style={styles.ismsBannerMasterText}>
                  Consolidated enterprise ledger across all salespersons with staff liability attribution and sign-off authority.
                </Text>
                <TouchableOpacity
                  style={styles.closeIsmsBtn}
                  onPress={() => setShowIsmsPolicy(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.closeIsmsBtnText}>Close / Minimize Policy ▴</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* KPI Overview Grid */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiBox, isDarkMode && styles.kpiBoxDark]}>
          <Text style={[styles.kpiLabel, isDarkMode && { color: '#B4D6D9' }]}>
            TOTAL ACTIVE DEBT
          </Text>
          <Text style={[styles.kpiValue, { color: isDarkMode ? '#FDE68A' : '#DC2626' }]}>
            Ksh {totalOutstanding.toLocaleString()}
          </Text>
          <Text style={[styles.kpiSub, isDarkMode && { color: '#CFE9EC' }]}>
            {filteredRecords.length} Credit records
          </Text>
        </View>

        <View style={[styles.kpiBox, isDarkMode && styles.kpiBoxDark]}>
          <Text style={[styles.kpiLabel, isDarkMode && { color: '#B4D6D9' }]}>
            HIGH-RISK EXPOSURE
          </Text>
          <Text style={[styles.kpiValue, { color: isDarkMode ? '#EE6C4D' : '#D97706' }]}>
            Ksh {highRiskDebt.toLocaleString()}
          </Text>
          <Text style={[styles.kpiSub, isDarkMode && { color: '#CFE9EC' }]}>
            Score &lt; 50 / 100
          </Text>
        </View>

        {pendingApprovalsCount > 0 && (
          <View style={[styles.kpiBox, styles.kpiBoxPending]}>
            <Text style={[styles.kpiLabel, { color: '#B45309' }]}>PENDING SIGN-OFF</Text>
            <Text style={[styles.kpiValue, { color: '#B45309' }]}>
              {pendingApprovalsCount}
            </Text>
            <Text style={[styles.kpiSub, { color: '#92400E' }]}>Awaiting Master</Text>
          </View>
        )}
      </View>

      {/* Search Input Bar */}
      <View style={[styles.searchBar, isDarkMode && styles.searchBarDark]}>
        <Ionicons name="search" size={16} color="#94A3B8" />
        <TextInput
          style={[styles.searchInput, isDarkMode && styles.textWhite]}
          placeholder="Search debtor name, phone, national ID, or truck plate..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Toggle Button */}
      <TouchableOpacity
        style={[styles.filterToggleCard, isDarkMode && styles.filterToggleCardDark]}
        onPress={() => setShowFilters(!showFilters)}
        activeOpacity={0.7}
      >
        <View style={styles.filterToggleLeft}>
          <Ionicons name="filter" size={15} color={isDarkMode ? '#F0FDFA' : '#0891B2'} />
          <Text style={[styles.filterToggleTitle, isDarkMode && styles.textWhite]}>
            Filter Debtor Records
          </Text>
          {activeFiltersCount > 0 && (
            <View style={styles.activeFilterBadge}>
              <Text style={styles.activeFilterBadgeText}>{activeFiltersCount} active</Text>
            </View>
          )}
        </View>
        <View style={styles.filterToggleRight}>
          <Text style={[styles.filterToggleAction, isDarkMode && { color: '#F0FDFA' }]}>
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Text>
          <Ionicons
            name={showFilters ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={isDarkMode ? '#F0FDFA' : '#0891B2'}
          />
        </View>
      </TouchableOpacity>

      {/* Structured Collapsible Filter Drawer */}
      {showFilters && (
        <View style={[styles.filterCardBox, isDarkMode && styles.filterCardBoxDark]}>
          <View style={styles.filterCardHeader}>
            <Text style={[styles.filterCardHeading, isDarkMode && styles.textWhite]}>
              Filter by Status, Score, Date & Staff
            </Text>
            {activeFiltersCount > 0 && (
              <TouchableOpacity onPress={resetFilters} style={styles.clearFiltersBtn}>
                <Text style={styles.clearFiltersText}>Reset All</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Group 1: Payment Status */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupLabel}>Payment Status</Text>
            <View style={styles.wrapChipContainer}>
              <TouchableOpacity
                style={[styles.wrapChip, statusFilter === 'ALL' && styles.wrapChipActive]}
                onPress={() => setStatusFilter('ALL')}
              >
                <Text style={[styles.wrapChipText, statusFilter === 'ALL' && styles.wrapChipTextActive]}>
                  All Status
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wrapChip, statusFilter === 'PENDING' && styles.wrapChipActive]}
                onPress={() => setStatusFilter('PENDING')}
              >
                <Text style={[styles.wrapChipText, statusFilter === 'PENDING' && styles.wrapChipTextActive]}>
                  Pending (Unpaid)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wrapChip, statusFilter === 'PAID' && styles.wrapChipActive]}
                onPress={() => setStatusFilter('PAID')}
              >
                <Text style={[styles.wrapChipText, statusFilter === 'PAID' && styles.wrapChipTextActive]}>
                  Credit Paid (Settled)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Group 2: Credit Score */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupLabel}>In-House Credit Score</Text>
            <View style={styles.wrapChipContainer}>
              <TouchableOpacity
                style={[styles.wrapChip, scoreFilter === 'ALL' && styles.wrapChipActive]}
                onPress={() => setScoreFilter('ALL')}
              >
                <Text style={[styles.wrapChipText, scoreFilter === 'ALL' && styles.wrapChipTextActive]}>
                  All Scores
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wrapChip, scoreFilter === 'EXCELLENT' && styles.wrapChipActive]}
                onPress={() => setScoreFilter('EXCELLENT')}
              >
                <Text style={[styles.wrapChipText, scoreFilter === 'EXCELLENT' && styles.wrapChipTextActive]}>
                  A+ Excellent (80+)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wrapChip, scoreFilter === 'GOOD' && styles.wrapChipActive]}
                onPress={() => setScoreFilter('GOOD')}
              >
                <Text style={[styles.wrapChipText, scoreFilter === 'GOOD' && styles.wrapChipTextActive]}>
                  B Reliable (65-79)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wrapChip, scoreFilter === 'FAIR' && styles.wrapChipActive]}
                onPress={() => setScoreFilter('FAIR')}
              >
                <Text style={[styles.wrapChipText, scoreFilter === 'FAIR' && styles.wrapChipTextActive]}>
                  C Fair (50-64)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wrapChip, scoreFilter === 'HIGH_RISK' && styles.wrapChipActiveAlert]}
                onPress={() => setScoreFilter('HIGH_RISK')}
              >
                <Text
                  style={[
                    styles.wrapChipText,
                    scoreFilter === 'HIGH_RISK' && styles.wrapChipTextActive,
                    { color: scoreFilter === 'HIGH_RISK' ? '#FFFFFF' : '#DC2626' },
                  ]}
                >
                  ⚠️ High Risk (&lt;50)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Group 3: Date Issued */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupLabel}>Date Issued</Text>
            <View style={styles.wrapChipContainer}>
              <TouchableOpacity
                style={[styles.wrapChip, dateFilter === 'ALL' && styles.wrapChipActive]}
                onPress={() => setDateFilter('ALL')}
              >
                <Text style={[styles.wrapChipText, dateFilter === 'ALL' && styles.wrapChipTextActive]}>
                  All Dates
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wrapChip, dateFilter === 'TODAY' && styles.wrapChipActive]}
                onPress={() => setDateFilter('TODAY')}
              >
                <Text style={[styles.wrapChipText, dateFilter === 'TODAY' && styles.wrapChipTextActive]}>
                  Today's Session
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wrapChip, dateFilter === 'PAST_3' && styles.wrapChipActive]}
                onPress={() => setDateFilter('PAST_3')}
              >
                <Text style={[styles.wrapChipText, dateFilter === 'PAST_3' && styles.wrapChipTextActive]}>
                  Past 3 Days
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wrapChip, dateFilter === 'PAST_7' && styles.wrapChipActive]}
                onPress={() => setDateFilter('PAST_7')}
              >
                <Text style={[styles.wrapChipText, dateFilter === 'PAST_7' && styles.wrapChipTextActive]}>
                  Past 7 Days
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Group 4: Person Liable Filter (Master view only) */}
          {role === 'MERCHANT' && distinctSellers.length > 0 && (
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupLabel}>Person Liable (Staff)</Text>
              <View style={styles.wrapChipContainer}>
                <TouchableOpacity
                  style={[styles.wrapChip, sellerFilter === 'ALL' && styles.wrapChipActive]}
                  onPress={() => setSellerFilter('ALL')}
                >
                  <Text style={[styles.wrapChipText, sellerFilter === 'ALL' && styles.wrapChipTextActive]}>
                    All Staff
                  </Text>
                </TouchableOpacity>
                {distinctSellers.map((seller) => (
                  <TouchableOpacity
                    key={seller}
                    style={[styles.wrapChip, sellerFilter === seller && styles.wrapChipActive]}
                    onPress={() => setSellerFilter(seller)}
                  >
                    <Text style={[styles.wrapChipText, sellerFilter === seller && styles.wrapChipTextActive]}>
                      {seller}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Credit Records Grouped by Batch & Date */}
      {groupedByBatchAndDate.length > 0 ? (
        groupedByBatchAndDate.map((group) => (
          <View key={group.batchKey} style={[styles.batchGroupCard, isDarkMode && styles.batchGroupCardDark]}>
            {/* Batch & Date Header Bar */}
            <View style={styles.batchGroupHeader}>
              <View style={styles.batchTitleRow}>
                <Ionicons name="cube" size={15} color="#0891B2" />
                <Text style={[styles.batchHeadingText, isDarkMode && styles.textWhite]}>
                  {group.batchNumber} • {group.truckPlate}
                </Text>
              </View>
              <View style={styles.batchDateBadge}>
                <Ionicons name="calendar-outline" size={11} color="#64748B" />
                <Text style={styles.batchDateText}>{group.dateIssued}</Text>
              </View>
            </View>

            <View style={styles.batchSubStatsRow}>
              <Text style={styles.batchSubStatsText}>
                {group.records.length} Credited transaction(s) • Total Debt: Ksh{' '}
                {group.batchTotalOutstanding.toLocaleString()}
              </Text>
            </View>

            {/* Individual Credited Persons in this Batch */}
            <View style={styles.recordsList}>
              {group.records.map((rec) => {
                const balance = rec.totalOwed - rec.amountPaid;
                const scoreInfo = getScoreBadgeColor(rec.customerCreditRating);
                const isPending = rec.approvalStatus === 'PENDING';

                return (
                  <View
                    key={rec.id}
                    style={[
                      styles.recordCard,
                      isDarkMode && styles.recordCardDark,
                      isPending && styles.recordCardPending,
                    ]}
                  >
                    {/* Top Row: Customer Info & In-House Credit Score */}
                    <View style={styles.recordHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.customerName, isDarkMode && styles.textWhite]}>
                          {rec.customerName}
                        </Text>
                        <Text style={styles.customerMeta}>
                          🪪 ID: {rec.customerNationalId || 'N/A'} • 📞{' '}
                          {maskPhoneNumber(rec.customerPhone)}
                        </Text>
                      </View>

                      {/* In-House Credit Score Badge */}
                      <View
                        style={[
                          styles.scoreBadge,
                          {
                            backgroundColor: scoreInfo.bg,
                            borderColor: scoreInfo.border,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="speedometer"
                          size={13}
                          color={scoreInfo.text}
                        />
                        <Text style={[styles.scoreBadgeText, { color: scoreInfo.text }]}>
                          Score: {rec.customerCreditScore}/100 ({scoreInfo.label})
                        </Text>
                      </View>
                    </View>

                    {/* Middle Row: Quantity, Grade & Person Liable */}
                    <View style={styles.recordDetailsRow}>
                      <View style={styles.detailPill}>
                        <Text style={styles.detailPillLabel}>SACKS</Text>
                        <Text style={styles.detailPillValue}>
                          {rec.quantityNets} nets ({rec.grade === 'GRADE_1' ? 'G1' : 'G2'})
                        </Text>
                      </View>

                      <View style={styles.detailPill}>
                        <Text style={styles.detailPillLabel}>DUE DATE</Text>
                        <Text style={styles.detailPillValue}>{rec.dueDate || '4-Day Term'}</Text>
                      </View>

                      <View style={styles.detailPill}>
                        <Text style={styles.detailPillLabel}>LIABLE STAFF</Text>
                        <Text style={[styles.detailPillValue, { color: '#0891B2' }]}>
                          {rec.personLiable || rec.sellerName || (rec.authorizedBy && rec.authorizedBy !== 'Nelson' && rec.authorizedBy !== 'Merchant Admin' ? rec.authorizedBy : effectiveMaster)}
                        </Text>
                      </View>
                    </View>

                    {/* Financial Figures Row */}
                    <View style={styles.financialRow}>
                      <View>
                        <Text style={styles.finLabel}>TOTAL OWED</Text>
                        <Text style={[styles.finAmount, isDarkMode && styles.textWhite]}>
                          Ksh {rec.totalOwed.toLocaleString()}
                        </Text>
                      </View>

                      <View>
                        <Text style={styles.finLabel}>PAID</Text>
                        <Text style={[styles.finAmount, { color: '#059669' }]}>
                          Ksh {rec.amountPaid.toLocaleString()}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.finLabel}>OUTSTANDING</Text>
                        <Text
                          style={[
                            styles.finAmountBold,
                            { color: balance > 0 ? '#DC2626' : '#059669' },
                          ]}
                        >
                          {balance > 0 ? `Ksh ${balance.toLocaleString()}` : 'SETTLED (KSH 0)'}
                        </Text>
                      </View>
                    </View>

                    {/* Approval & Action Bar */}
                    <View style={styles.actionBar}>
                      {isPending ? (
                        <View style={styles.pendingBanner}>
                          <Ionicons name="time-outline" size={14} color="#D97706" />
                          <Text style={styles.pendingBannerText}>
                            PENDING MASTER SIGN-OFF
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.approvedBanner}>
                          <Ionicons name="checkmark-circle-outline" size={14} color="#059669" />
                          <Text style={styles.approvedBannerText}>
                            MASTER APPROVED • 4-DAY MAXIMUM TERM
                          </Text>
                        </View>
                      )}

                      {/* Master Approval Buttons */}
                      {role === 'MERCHANT' && isPending && (
                        <View style={styles.masterApprovalBtnRow}>
                          <TouchableOpacity
                            style={styles.rejectBtn}
                            onPress={() => handleRejectCredit(rec.id, rec.customerName, rec.totalOwed)}
                          >
                            <Text style={styles.rejectBtnText}>Reject</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.approveBtn}
                            onPress={() => handleApproveCredit(rec.id, rec.customerName, rec.totalOwed)}
                          >
                            <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                            <Text style={styles.approveBtnText}>Approve</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Repayment Trigger */}
                      {balance > 0 && !isPending && (
                        <TouchableOpacity
                          style={styles.recordRepayBtn}
                          onPress={() => handleOpenRepayment(rec.customerId, rec.id, balance)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="cash" size={13} color="#FFFFFF" />
                          <Text style={styles.recordRepayBtnText}>Collect Payment</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))
      ) : (
        <View style={[styles.emptyBox, isDarkMode && styles.emptyBoxDark]}>
          <Ionicons
            name="document-text-outline"
            size={32}
            color={isDarkMode ? '#B4D6D9' : '#94A3B8'}
          />
          <Text style={[styles.emptyTitle, isDarkMode && { color: '#F0FDFA' }]}>
            No Credit Records Found
          </Text>
          <Text style={[styles.emptyDesc, isDarkMode && { color: '#CFE9EC' }]}>
            {role === 'SELLER'
              ? 'No debtor records found for your sales sessions matching the selected filters.'
              : 'No credited persons match the applied criteria. Adjust filters or search terms.'}
          </Text>
        </View>
      )}

      {/* --- REPAYMENT MODAL --- */}
      <Modal
        visible={payingEntryId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPayingEntryId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDarkMode && styles.modalCardDark]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="cash-outline" size={20} color="#059669" />
                <Text style={[styles.modalTitle, isDarkMode && styles.textWhite]}>
                  Collect Credit Repayment
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPayingEntryId(null)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, isDarkMode && { color: '#94A3B8' }]}>
              Enter collected cash or M-Pesa amount. Recorded into today's reconciliation without duplicating sack stock counts.
            </Text>

            {/* Payment Method Selector */}
            <View style={styles.methodSelectorRow}>
              <TouchableOpacity
                style={[
                  styles.methodBtn,
                  repayMethod === 'MPESA' && styles.methodBtnActiveMpesa,
                ]}
                onPress={() => setRepayMethod('MPESA')}
              >
                <Ionicons
                  name="phone-portrait"
                  size={14}
                  color={repayMethod === 'MPESA' ? '#FFFFFF' : '#059669'}
                />
                <Text
                  style={[
                    styles.methodBtnText,
                    repayMethod === 'MPESA' && styles.methodBtnTextActive,
                  ]}
                >
                  M-Pesa Buy Goods
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.methodBtn,
                  repayMethod === 'CASH' && styles.methodBtnActiveCash,
                ]}
                onPress={() => setRepayMethod('CASH')}
              >
                <MaterialCommunityIcons
                  name="cash"
                  size={16}
                  color={repayMethod === 'CASH' ? '#FFFFFF' : '#0891B2'}
                />
                <Text
                  style={[
                    styles.methodBtnText,
                    repayMethod === 'CASH' && styles.methodBtnTextActive,
                  ]}
                >
                  Physical Cash
                </Text>
              </TouchableOpacity>
            </View>

            {/* Repayment Amount */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, isDarkMode && styles.textWhite]}>
                Repayment Amount (Ksh):
              </Text>
              <TextInput
                style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                keyboardType="numeric"
                value={repayAmount}
                onChangeText={setRepayAmount}
                placeholder="e.g. 5000"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* M-Pesa Code if applicable */}
            {repayMethod === 'MPESA' && (
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, isDarkMode && styles.textWhite]}>
                  M-Pesa Receipt Code (Optional):
                </Text>
                <TextInput
                  style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                  value={mpesaRef}
                  onChangeText={setMpesaRef}
                  placeholder="e.g. QJK9923KPP"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                />
              </View>
            )}

            {/* Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPayingEntryId(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleConfirmRepayment}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
                <Text style={styles.modalSubmitBtnText}>Confirm Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 24,
  },
  containerDark: {},
  ismsBannerSeller: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  ismsBannerSellerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  ismsBannerSellerText: {
    fontSize: 10,
    color: '#047857',
    marginTop: 1,
  },
  ismsBannerMaster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#A5F3FC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  ismsBannerMasterTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0891B2',
  },
  ismsBannerMasterText: {
    fontSize: 10,
    color: '#0E7490',
    marginTop: 1,
  },
  minimizedPolicyBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
  },
  minimizedPolicyBarDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
  },
  minimizedPolicyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  minimizedPolicyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  minimizedPolicyToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0891B2',
    marginLeft: 6,
  },
  closeIsmsBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  closeIsmsBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiBoxDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
  },
  kpiBoxPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
  },
  searchBarDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
  },

  // Filter Toggle & Structured Drawer
  filterToggleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  filterToggleCardDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
  },
  filterToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterToggleTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  activeFilterBadge: {
    backgroundColor: '#0891B2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activeFilterBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  filterToggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterToggleAction: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0891B2',
  },
  filterCardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  filterCardBoxDark: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
  },
  filterCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
  },
  filterCardHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  clearFiltersBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clearFiltersText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  filterGroup: {
    gap: 4,
  },
  filterGroupLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  wrapChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  wrapChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  wrapChipActive: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  wrapChipActiveAlert: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  wrapChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  wrapChipTextActive: {
    color: '#FFFFFF',
  },

  // Batch Groups
  batchGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
  },
  batchGroupCardDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
  },
  batchGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
    marginBottom: 4,
  },
  batchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  batchHeadingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  batchDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  batchDateText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  batchSubStatsRow: {
    marginBottom: 8,
  },
  batchSubStatsText: {
    fontSize: 10,
    color: '#64748B',
  },

  // Records List
  recordsList: {
    gap: 8,
  },
  recordCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  recordCardDark: {
    backgroundColor: '#1B4F55',
    borderColor: 'rgba(122, 181, 188, 0.45)',
    borderWidth: 0.75,
  },
  recordCardPending: {
    borderColor: '#FDE68A',
    borderWidth: 1.5,
  },
  recordHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  customerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  customerMeta: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  scoreBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  recordDetailsRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderRadius: 6,
    marginBottom: 6,
  },
  detailPill: {
    flex: 1,
  },
  detailPillLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94A3B8',
  },
  detailPillValue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
    marginTop: 1,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 2,
  },
  finLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
  },
  finAmount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  finAmountBold: {
    fontSize: 12,
    fontWeight: '900',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pendingBannerText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
  },
  approvedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  approvedBannerText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#059669',
  },
  masterApprovalBtnRow: {
    flexDirection: 'row',
    gap: 6,
  },
  rejectBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#FEE2E2',
  },
  rejectBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#059669',
  },
  approveBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  recordRepayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0891B2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recordRepayBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Empty State
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyBoxDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyDesc: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 15,
  },

  // Repayment Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: 16,
  },
  modalCardDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
    marginBottom: 10,
  },
  methodSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  methodBtnActiveMpesa: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  methodBtnActiveCash: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  methodBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  methodBtnTextActive: {
    color: '#FFFFFF',
  },
  formGroup: {
    marginBottom: 10,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 3,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0F172A',
  },
  modalInputDark: {
    backgroundColor: '#1D575D',
    borderColor: '#7AB5BC',
    color: '#F0FDFA',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  modalSubmitBtn: {
    flex: 2,
    backgroundColor: '#059669',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 6,
  },
  modalSubmitBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  textWhite: {
    color: '#FFFFFF',
  },
});
