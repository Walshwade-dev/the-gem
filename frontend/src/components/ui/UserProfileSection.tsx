// ============================================================================
// The Gem: User Profile & Account Section
// Personal info, independent Master & Store name editing, mobile & national ID,
// role-based operational policies & standards, mandatory liability acceptance,
// truck stay day setting, seller quota delegation, debtor overview, and store payment modes
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  Modal,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';
import { confirmAndRevokeAssignment } from '../../utils/revokeAssignmentPrompt';
import { useAppStore } from '../../store/useAppStore';
import { CustomerCredit, CreditEntry } from '../../types';
import {
  ensureSimSmsPermissions,
  listActiveSims,
  sendDirectSimSms,
  SimSlotInfo,
} from '../../hooks/useSimSmsGateway';

interface UserProfileSectionProps {
  onOpenCreditLedger: () => void;
  onOpenSellerModal: () => void;
  onLogout: () => void;
  isDarkMode?: boolean;
}

export const UserProfileSection: React.FC<UserProfileSectionProps> = ({
  onOpenCreditLedger,
  onOpenSellerModal,
  onLogout,
  isDarkMode = false,
}) => {
  const {
    role,
    currentUserId,
    currentUserName,
    storeName,
    currentUserPhone,
    currentUserNationalId,
    updateMasterProfile,
    setBatchDay,
    customerCredits,
    allocations,
    currentBatch,
    merchantPolicyAccepted,
    merchantPolicyAcceptedAt,
    sellerPolicyAccepted,
    sellerPolicyAcceptedAt,
    acceptPolicy,
    acknowledgeStockAllocation,
    reportStockDiscrepancy,
    masterName,
    acceptedPaymentModes,
    togglePaymentMode,
    revokeSellerAssignment,
    simSmsGatewayEnabled,
    simSmsSentCount,
    selectedSimSubId,
    pochiPhoneNumber,
    masterPhoneNumber,
    setSimSmsGatewayEnabled,
    setSelectedSimSubId,
    setPochiPhoneNumber,
    setMasterPhoneNumber,
    incrementSimSmsSent,
  } = useAppStore();

  const [activeSims, setActiveSims] = useState<SimSlotInfo[]>([]);
  const [testSmsPhone, setTestSmsPhone] = useState('');
  const [sendingTestSms, setSendingTestSms] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android' && simSmsGatewayEnabled) {
      void listActiveSims().then((sims) => {
        setActiveSims(sims);
        if (selectedSimSubId === null && sims.length > 0) {
          const def = sims.find((s) => s.isDefaultSmsSim) ?? sims[0];
          setSelectedSimSubId(def.subscriptionId);
        }
      });
    }
  }, [simSmsGatewayEnabled, selectedSimSubId, setSelectedSimSubId]);

  const paymentModes = acceptedPaymentModes || { CASH: true, MPESA: true, CREDIT: true };
  const handleTogglePaymentMode = (mode: 'MPESA' | 'CASH' | 'CREDIT') => {
    if (role !== 'MERCHANT') return;
    const isCurrentlyActive = paymentModes[mode];
    const activeCount = Object.values(paymentModes).filter(Boolean).length;
    if (isCurrentlyActive && activeCount <= 1) {
      Alert.alert('Minimum One Mode Required', 'At least one payment mode must remain active for store sales.');
      return;
    }
    togglePaymentMode(mode);
  };

  const effectiveMaster = masterName || (role === 'MERCHANT' ? currentUserName : '') || 'Master';

  // Master profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [adminNameInput, setAdminNameInput] = useState(effectiveMaster);
  const [storeNameInput, setStoreNameInput] = useState(storeName || 'NKACE Enterprise');
  const [phoneInput, setPhoneInput] = useState(currentUserPhone || '+254712345678');
  const [nationalIdInput, setNationalIdInput] = useState(currentUserNationalId || '29841029');

  // Seller Assigned Stock Discrepancy Modal State
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
  const [reportedG1, setReportedG1] = useState('');
  const [reportedG2, setReportedG2] = useState('');
  const [discrepancyReason, setDiscrepancyReason] = useState('');

  // Keep local inputs in sync when store updates
  useEffect(() => {
    setAdminNameInput(masterName || (role === 'MERCHANT' ? currentUserName : '') || 'Master');
    setStoreNameInput(storeName || 'NKACE Enterprise');
    setPhoneInput(currentUserPhone || '+254712345678');
    setNationalIdInput(currentUserNationalId || '29841029');
  }, [currentUserName, masterName, storeName, currentUserPhone, currentUserNationalId, role]);

  // Active seller allocation lookup (Single source of truth)
  const sellerAllocation = useMemo(() => {
    if (!allocations || allocations.length === 0) return null;
    return (
      allocations.find(
        (a) =>
          a.sellerId === currentUserId ||
          a.sellerName.toLowerCase().includes((currentUserName || '').toLowerCase()) ||
          (currentUserName || '').toLowerCase().includes(a.sellerName.toLowerCase())
      ) || allocations[0]
    );
  }, [allocations, currentUserId, currentUserName]);

  // Policy & SOP Acceptance State (Minimized by default, user clicks to open fully, closes on approve/close)
  const isPolicyAccepted = role === 'MERCHANT' ? merchantPolicyAccepted : sellerPolicyAccepted;
  const acceptedAt = role === 'MERCHANT' ? merchantPolicyAcceptedAt : sellerPolicyAcceptedAt;
  const [isPolicyExpanded, setIsPolicyExpanded] = useState(false);
  const [hasCheckedAgreement, setHasCheckedAgreement] = useState(false);

  // Save Master Profile (Admin Name and Store Name are completely independent)
  const handleSaveMasterProfile = () => {
    if (!adminNameInput.trim()) {
      Alert.alert('Invalid Input', 'Master Admin Name cannot be empty.');
      return;
    }
    if (!storeNameInput.trim()) {
      Alert.alert('Invalid Input', 'Store Name cannot be empty.');
      return;
    }
    if (!phoneInput.trim()) {
      Alert.alert('Invalid Input', 'Mobile number cannot be empty.');
      return;
    }
    if (!nationalIdInput.trim()) {
      Alert.alert('Invalid Input', 'National ID cannot be empty.');
      return;
    }

    updateMasterProfile({
      adminName: adminNameInput.trim(),
      storeName: storeNameInput.trim(),
      phone: phoneInput.trim(),
      nationalId: nationalIdInput.trim(),
    });

    setIsEditingProfile(false);
    Alert.alert(
      '✅ Master Credentials Saved',
      `Master Name: "${adminNameInput.trim()}"\nStore: "${storeNameInput.trim()}"\nPhone: ${phoneInput.trim()}\nID: ${nationalIdInput.trim()}`
    );
  };

  // Single Source of Truth Stock Acknowledgment
  const handleAcknowledgeStock = () => {
    if (!sellerAllocation) return;
    acknowledgeStockAllocation(sellerAllocation.id);
    Alert.alert(
      '✅ Stock Acknowledged & Received',
      `You have verified and accepted physical custody of:\n• Grade 1: ${sellerAllocation.grade1Allocated} nets\n• Grade 2: ${sellerAllocation.grade2Allocated} nets\nTotal: ${sellerAllocation.grade1Allocated + sellerAllocation.grade2Allocated} nets.\n\nVerified in Master audit trail.`
    );
  };

  // Open Discrepancy Reporting Modal
  const handleOpenDiscrepancyModal = () => {
    if (!sellerAllocation) return;
    setReportedG1(String(sellerAllocation.physicalCountGrade1 ?? sellerAllocation.grade1Allocated));
    setReportedG2(String(sellerAllocation.physicalCountGrade2 ?? sellerAllocation.grade2Allocated));
    setDiscrepancyReason(sellerAllocation.discrepancyNote || '');
    setShowDiscrepancyModal(true);
  };

  // Submit Discrepancy to Master
  const handleSubmitDiscrepancy = () => {
    if (!sellerAllocation) return;
    const g1 = parseInt(reportedG1, 10);
    const g2 = parseInt(reportedG2, 10);
    if (isNaN(g1) || isNaN(g2)) {
      Alert.alert('Invalid Count', 'Please enter valid numerical net counts for both Grade 1 and Grade 2.');
      return;
    }
    if (!discrepancyReason.trim()) {
      Alert.alert('Reason Required', 'Please provide a brief reason explaining the physical stock count mismatch.');
      return;
    }

    reportStockDiscrepancy(sellerAllocation.id, {
      physicalG1: g1,
      physicalG2: g2,
      note: discrepancyReason.trim(),
    });

    setShowDiscrepancyModal(false);
    Alert.alert(
      '⚠️ Stock Discrepancy Logged',
      `Your physical count (G1: ${g1}, G2: ${g2}) has been flagged.\nMaster has received an alert for investigation and approval.`
    );
  };

  const handleAcceptPolicy = () => {
    if (!hasCheckedAgreement) {
      Alert.alert(
        'Agreement Required',
        'Please check the acknowledgment box confirming you have read and understood your operational liabilities and job standards.'
      );
      return;
    }
    acceptPolicy(role);
    setIsPolicyExpanded(false);
    Alert.alert(
      '✅ Policy Acknowledged & Signed',
      `You have formally accepted your operational liabilities, job description, payment terms, and Wakulima Market standards as ${
        role === 'MERCHANT' ? 'Master' : 'Sales Agent'
      }.`
    );
  };

  const handleDaySelect = (day: number) => {
    if (day === currentBatch?.dayNumber) return;
    Alert.alert(
      `Set Truck Stay to Day ${day}?`,
      day === 1
        ? 'Day 1: Base NCC Cess applies with nets officially counted and covered.'
        : day === 5
        ? 'Day 5: Negotiated Extension • Flat Ksh 1,000 demurrage fee.'
        : `Day ${day} of 4: Flat Ksh 1,000 daily county fee without net recount.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Confirm Day ${day}`,
          onPress: () => {
            setBatchDay(day);
          },
        },
      ]
    );
  };

  // Debtor metrics (ISMS & QMS Role Separation)
  const filteredCustomerCredits: CustomerCredit[] = useMemo(() => {
    if (role === 'MERCHANT') return customerCredits;
    const todayStr = new Date().toISOString().split('T')[0];
    const normName = (currentUserName || '').toLowerCase().trim();
    return customerCredits
      .map((cust: CustomerCredit) => ({
        ...cust,
        records: cust.records.filter((r: CreditEntry) => {
          const liable = (r.personLiable || r.sellerName || r.authorizedBy || '').toLowerCase();
          const matches =
            r.sellerId === currentUserId ||
            liable.includes(normName) ||
            normName.includes(liable) ||
            (normName.includes('juma') && liable.includes('juma'));
          if (!matches) return false;
          const isToday = r.dateIssued === todayStr;
          const isUnpaid = r.totalOwed > r.amountPaid;
          return isToday || isUnpaid;
        }),
      }))
      .filter((cust: CustomerCredit) => cust.records.length > 0);
  }, [customerCredits, role, currentUserId, currentUserName]);

  const totalDebtors = filteredCustomerCredits.length;
  const totalOutstandingCredit = filteredCustomerCredits.reduce(
    (sum: number, c: CustomerCredit) =>
      sum +
      c.records.reduce((rSum: number, r: CreditEntry) => rSum + Math.max(0, r.totalOwed - r.amountPaid), 0),
    0
  );
  const pendingApprovals = filteredCustomerCredits.flatMap((c: CustomerCredit) =>
    c.records.filter((r: CreditEntry) => r.approvalStatus === 'PENDING')
  ).length;

  return (
    <View style={styles.container}>
      {/* 1. Profile Header Card & Credentials */}
      <View style={[styles.profileCard, isDarkMode && styles.profileCardDark]}>
        <View style={styles.profileHeaderRow}>
          <View style={styles.avatarWrapper}>
            <Image
              source={require('../../../assets/faceted-onion-transparent.png')}
              style={styles.avatarImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.profileDetails}>
            {role !== 'MERCHANT' && (
              <View style={styles.roleRow}>
                <View style={[styles.roleBadge, styles.roleSeller]}>
                  <Text style={styles.roleBadgeText}>SALES AGENT</Text>
                </View>
              </View>
            )}

            {/* If Master, show Store Name + Admin Name */}
            {role === 'MERCHANT' ? (
              <View>
                <Text style={[styles.storeHeading, isDarkMode && styles.textWhite]}>
                  {storeName || 'NKACE Enterprise'}
                </Text>
                <Text style={[styles.adminNameSub, isDarkMode && styles.textMutedDark]}>
                  Master: <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>{effectiveMaster}</Text>
                </Text>
                <Text style={[styles.userContact, isDarkMode && styles.textSubtleDark]}>
                  ID: {currentUserNationalId || '29841029'} • {currentUserPhone || '+254712345678'}
                </Text>
              </View>
            ) : (
              /* Seller view: Single Source of Truth, Read-Only Credentials Assigned by Master */
              <View>
                <View style={styles.userNameRow}>
                  <Text style={[styles.userName, isDarkMode && styles.textWhite]}>
                    {currentUserName || 'Juma (Sales Assistant)'}
                  </Text>
                  <View style={[styles.lockedBadge, isDarkMode && styles.lockedBadgeDark]}>
                    <Ionicons name="lock-closed" size={11} color={isDarkMode ? '#CFE9EC' : '#059669'} />
                    <Text style={[styles.lockedBadgeText, isDarkMode && styles.textMutedDark]}>
                      Master-Assigned
                    </Text>
                  </View>
                </View>
                <Text style={[styles.userContact, isDarkMode && styles.textSubtleDark]}>
                  ID: {currentUserNationalId || '31289410'} • {currentUserPhone || '+254799887766'}
                </Text>
                <Text style={[styles.sellerRoleSub, isDarkMode && styles.textSubtleDark]}>
                  Assigned Marikiti Wholesale Sales Agent • Locked Single Source of Truth
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Master Profile Edit Toggle Button */}
        {role === 'MERCHANT' && !isEditingProfile && (
          <TouchableOpacity
            style={[styles.editMasterBtn, isDarkMode && styles.editMasterBtnDark]}
            onPress={() => setIsEditingProfile(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil-outline" size={14} color={isDarkMode ? '#F0FDFA' : '#0891B2'} />
            <Text style={[styles.editMasterBtnText, isDarkMode && styles.textWhite]}>
              Edit Master & Store Credentials
            </Text>
          </TouchableOpacity>
        )}

        {/* Master Credentials Edit Form (Independent Store vs Admin Name) */}
        {role === 'MERCHANT' && isEditingProfile && (
          <View style={[styles.editFormBox, isDarkMode && styles.editFormBoxDark]}>
            <View style={[styles.editFormHeader, isDarkMode && styles.editFormHeaderDark]}>
              <Text style={[styles.editFormTitle, isDarkMode && styles.textWhite]}>
                Edit Master & Store Credentials
              </Text>
            </View>

            {/* Admin Name Input */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, isDarkMode && styles.textMutedDark]}>
                Master / Admin Name:
              </Text>
              <TextInput
                style={[styles.formInput, isDarkMode && styles.formInputDark]}
                value={adminNameInput}
                onChangeText={setAdminNameInput}
                placeholder="e.g. Master or Your Name"
                placeholderTextColor={isDarkMode ? '#8EC2C8' : '#94A3B8'}
              />
              <Text style={[styles.formHelper, isDarkMode && styles.textSubtleDark]}>
                Your personal administrator identifier.
              </Text>
            </View>

            {/* Store Name Input (Independent!) */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, isDarkMode && styles.textMutedDark]}>
                Store / Business Name:
              </Text>
              <TextInput
                style={[styles.formInput, isDarkMode && styles.formInputDark]}
                value={storeNameInput}
                onChangeText={setStoreNameInput}
                placeholder="e.g. NKACE Enterprise"
                placeholderTextColor={isDarkMode ? '#8EC2C8' : '#94A3B8'}
              />
              <Text style={[styles.formHelper, isDarkMode && styles.textSubtleDark]}>
                Independent store name. Changing admin name does NOT change store name.
              </Text>
            </View>

            {/* Mobile Phone Input */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, isDarkMode && styles.textMutedDark]}>
                Mobile Number:
              </Text>
              <TextInput
                style={[styles.formInput, isDarkMode && styles.formInputDark]}
                value={phoneInput}
                onChangeText={setPhoneInput}
                keyboardType="phone-pad"
                placeholder="e.g. +254712345678"
                placeholderTextColor={isDarkMode ? '#8EC2C8' : '#94A3B8'}
              />
            </View>

            {/* National ID Input */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, isDarkMode && styles.textMutedDark]}>
                National ID Number:
              </Text>
              <TextInput
                style={[styles.formInput, isDarkMode && styles.formInputDark]}
                value={nationalIdInput}
                onChangeText={setNationalIdInput}
                keyboardType="numeric"
                placeholder="e.g. 29841029"
                placeholderTextColor={isDarkMode ? '#8EC2C8' : '#94A3B8'}
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.formActionRow}>
              <TouchableOpacity
                style={styles.cancelFormBtn}
                onPress={() => {
                  setAdminNameInput(effectiveMaster);
                  setStoreNameInput(storeName || 'NKACE Enterprise');
                  setPhoneInput(currentUserPhone || '+254712345678');
                  setNationalIdInput(currentUserNationalId || '29841029');
                  setIsEditingProfile(false);
                }}
              >
                <Text style={styles.cancelFormBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveFormBtn}
                onPress={handleSaveMasterProfile}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-done" size={15} color="#FFFFFF" />
                <Text style={styles.saveFormBtnText}>Save Master Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* 2. Role-Based Operational Policies & SOPs (Minimized by default, user clicks to open fully) */}
      <View
        style={[
          styles.policyCard,
          isDarkMode && styles.policyCardDark,
          !isPolicyAccepted && styles.policyCardPending,
        ]}
      >
        <TouchableOpacity
          style={styles.policyHeaderTouchable}
          onPress={() => setIsPolicyExpanded((prev) => !prev)}
          activeOpacity={0.7}
        >
          <View style={styles.policyHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.policyCardTitle, isDarkMode && styles.textWhite]}>
                OPERATIONAL POLICIES & SOPS ({role === 'MERCHANT' ? 'MASTER' : 'SALES AGENT'})
              </Text>
              {!isPolicyExpanded && (
                <Text style={[styles.policyCardSubminimized, isDarkMode && styles.textSubtleDark]}>
                  Standard Operating Procedures, daily duties, legal liabilities & market rules
                </Text>
              )}
            </View>
            <View
              style={[
                styles.togglePolicyBtn,
                isDarkMode && styles.togglePolicyBtnDark,
                isPolicyExpanded && (isDarkMode ? styles.togglePolicyBtnExpandedDark : styles.togglePolicyBtnExpanded),
              ]}
            >
              <Text style={[styles.togglePolicyBtnText, isDarkMode && styles.textWhite]}>
                {isPolicyExpanded ? 'Hide / Minimize' : 'Tap to Open'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Acceptance Status Banner (Clickable when minimized to activate full open) */}
        <TouchableOpacity
          onPress={() => setIsPolicyExpanded((prev) => !prev)}
          activeOpacity={0.8}
        >
          {isPolicyAccepted ? (
            <View style={[styles.acceptedBanner, isDarkMode && styles.nestedSubBoxDark]}>
              <Ionicons name="checkmark-circle" size={16} color={isDarkMode ? '#CFE9EC' : '#059669'} />
              <Text style={[styles.acceptedBannerText, isDarkMode && styles.textMutedDark]}>
                Signed & Active: Accepted on {acceptedAt || 'Record'} • Bound by Kenya Commercial Code & DPA 2019
              </Text>
              {!isPolicyExpanded && (
                <Ionicons name="chevron-down" size={14} color={isDarkMode ? '#CFE9EC' : '#059669'} />
              )}
            </View>
          ) : (
            <View style={[styles.pendingPromptBanner, isDarkMode && styles.pendingPromptBannerDark]}>
              <Ionicons name="warning" size={16} color={isDarkMode ? '#FDE68A' : '#D97706'} />
              <Text style={[styles.pendingPromptBannerText, isDarkMode && { color: '#FEF3C7' }]}>
                MANDATORY SIGN-OFF REQUIRED: Tap to activate, review liabilities, job duties & approve SOPs.
              </Text>
              {!isPolicyExpanded && (
                <Ionicons name="chevron-down" size={14} color={isDarkMode ? '#FDE68A' : '#D97706'} />
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* Detailed Role-Based Policies (Expanded View) */}
        {isPolicyExpanded && (
          <View style={styles.policyContentContainer}>
            {/* 1. Job Description & Daily Operational Duties */}
            <View style={[styles.policySectionBlock, isDarkMode && styles.policySectionBlockDark]}>
              <View style={styles.policySectionHeader}>
                <Text style={[styles.policySectionHeading, isDarkMode && styles.textWhite]}>
                  1. JOB DESCRIPTION & DAILY DUTIES
                </Text>
              </View>
              {role === 'SELLER' ? (
                <View style={styles.bulletList}>
                  <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark]}>
                    • <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>Morning Bay Custody (05:00 AM)</Text>: Inspect assigned Grade 1 & 2 nets at Marikiti bay; verify physical count against allocation quota.
                  </Text>
                  <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark]}>
                    • <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>Negotiated Wholesale Selling</Text>: Sell at or above baseline price targets (G1: Ksh 2,500; G2: Ksh 2,000). Never discount below baseline without Master approval.
                  </Text>
                  <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark]}>
                    • <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>Real-Time Payment Verification</Text>: Collect cash into register or confirm customer M-Pesa Buy Goods Till 981244 SMS code before releasing sacks.
                  </Text>
                  <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark]}>
                    • <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>Credit Protocol</Text>: Collect buyer National ID and phone consent. Credit is provisional until Master SMS signs off.
                  </Text>
                </View>
              ) : (
                <View style={styles.bulletList}>
                  <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark]}>
                    • <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>Procurement & Haulage</Text>: Finance bulk farm sourcing and manage multi-ton transport logistics into Nairobi.
                  </Text>
                  <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark]}>
                    • <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>County Cess Clearance</Text>: Settle official Nairobi City County (NCC) cess barcode receipt as assessed by county gate inspectors on Day 1 entry.
                  </Text>
                  <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark]}>
                    • <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>Staff Delegation</Text>: Assign daily stock quotas and baseline price targets to hired sales staff and coordinate casual offloaders.
                  </Text>
                  <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark]}>
                    • <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>Credit & COB Governance</Text>: Review debtor National IDs, approve credit requests, and audit 14:00 COB cash/M-Pesa balance.
                  </Text>
                </View>
              )}
            </View>

            {/* 2. Operational Liabilities & Financial Accountability */}
            <View style={[styles.policySectionBlock, isDarkMode && styles.policySectionBlockDark]}>
              <View style={styles.policySectionHeader}>
                <Text style={[styles.policySectionHeading, isDarkMode ? styles.textWhite : { color: '#B91C1C' }]}>
                  2. OPERATIONAL LIABILITIES & ACCOUNTABILITY
                </Text>
              </View>
              {role === 'SELLER' ? (
                <View style={styles.bulletList}>
                  <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark]}>
                    • <Text style={[styles.boldText, isDarkMode ? styles.textWhite : { color: '#B91C1C' }]}>Cash Shortage Liability</Text>: 100% personally liable for cash discrepancies at 14:00 COB. Any shortfall is deducted directly from daily remuneration.
                  </Text>
                  <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark]}>
                    • <Text style={[styles.boldText, isDarkMode ? styles.textWhite : { color: '#B91C1C' }]}>Unapproved Credit Penalties</Text>: Releasing sacks on credit without Master SMS confirmation makes the seller personally responsible for the full debt.
                  </Text>
                  <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark]}>
                    • <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>Kenya DPA Compliance</Text>: Buyer contacts and National IDs must be kept strictly confidential under Kenya Data Protection Act 2019.
                  </Text>
                </View>
              ) : (
                <View style={styles.bulletList}>
                  <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark]}>
                    • <Text style={[styles.boldText, isDarkMode ? styles.textWhite : { color: '#B91C1C' }]}>County Demurrage Liability</Text>: Bound to Wakulima 4-Day Maximum Stay. Day 1 is base cess; Days 2–4 incur flat Ksh 1,000/day fee. Uncleared trucks risk impoundment.
                  </Text>
                  <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark]}>
                    • <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>Credit Default Risk</Text>: Master bears default risk on approved credits and holds legal recourse under Kenya Law of Contract.
                  </Text>
                  <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark]}>
                    • <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>Casual Labor Welfare</Text>: Legally required to pay agreed daily wages to offloaders (Ksh 700/worker) and night watchmen (Ksh 100/night).
                  </Text>
                </View>
              )}
            </View>

            {/* 3. Compensation & Remuneration Standards */}
            <View style={[styles.policySectionBlock, isDarkMode && styles.policySectionBlockDark]}>
              <View style={styles.policySectionHeader}>
                <Text style={[styles.policySectionHeading, isDarkMode ? styles.textWhite : { color: '#047857' }]}>
                  3. REMUNERATION & FINANCIAL STANDARDS
                </Text>
              </View>
              {role === 'SELLER' ? (
                <View style={styles.bulletList}>
                  <View style={[styles.salaryRangeBox, isDarkMode && styles.nestedSubBoxDark]}>
                    <Text style={[styles.salaryRangeLabel, isDarkMode && styles.textSubtleDark]}>
                      DAILY RETAINER / WAGE
                    </Text>
                    <Text style={[styles.salaryRangeValue, isDarkMode && styles.textWhite]}>
                      Ksh 800 – Ksh 1,200 / day
                    </Text>
                  </View>
                  <View style={[styles.salaryRangeBox, isDarkMode && styles.nestedSubBoxDark]}>
                    <Text style={[styles.salaryRangeLabel, isDarkMode && styles.textSubtleDark]}>
                      PERFORMANCE INCENTIVE
                    </Text>
                    <Text style={[styles.salaryRangeValue, isDarkMode && styles.textWhite]}>
                      Ksh 30 – Ksh 50 / net
                    </Text>
                    <Text style={[styles.salaryRangeSubtext, isDarkMode && styles.textMutedDark]}>
                      Bonus for every net sold at or above baseline target price
                    </Text>
                  </View>
                  <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark, { marginTop: 4 }]}>
                    • <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>Disbursement</Text>: Paid daily via Cash or M-Pesa immediately following 14:00 COB drawer balance.
                  </Text>
                </View>
              ) : (
                <View style={styles.bulletList}>
                  <View style={[styles.masterLedgerNoticeBox, isDarkMode && styles.nestedSubBoxDark]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.masterLedgerNoticeTitle, isDarkMode && styles.textWhite]}>
                        BOOKKEEPING & PROFIT BALANCING
                      </Text>
                      <Text style={[styles.masterLedgerNoticeDesc, isDarkMode && styles.textMutedDark]}>
                        Batch wholesale profit margins, purchasing expenses (produce kg price, packaging sacks, freight, broker, farm loaders), and market overheads are tracked live in the Master Ledger receipt.
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark, { marginTop: 8 }]}>
                    • <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>Operating Overheads</Text>: Security Watchman (Ksh 100/night), Sweeping & Sanitation (Ksh 100/day), Casual Offloaders (Ksh 700/worker). Demurrage (Ksh 1,000/day for Days 2–4). Morning chai and mandazi are personal and not store expenses.
                  </Text>
                </View>
              )}
            </View>

            {/* 4. Wakulima Market Statutory Standards */}
            <View style={[styles.policySectionBlock, isDarkMode && styles.policySectionBlockDark]}>
              <View style={styles.policySectionHeader}>
                <Text style={[styles.policySectionHeading, isDarkMode ? styles.textWhite : { color: '#B45309' }]}>
                  4. WAKULIMA MARKET STATUTORY STANDARDS
                </Text>
              </View>
              <View style={styles.bulletList}>
                <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark]}>
                  • <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>Market Hours</Text>: 05:00 AM entry to 14:00 EAT mandatory COB drawer closure and lane clearing.
                </Text>
                <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark]}>
                  • <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>Grade Sorting</Text>: Grade 1 (firm cured bulbs) vs Grade 2 (commercial). Rotted bulbs discarded at designated compost pits.
                </Text>
                <Text style={[styles.bulletItem, isDarkMode && styles.textMutedDark]}>
                  • <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>4-Day Rule</Text>: Maximum 4 days per truck stay (Day 5 negotiated extension only).
                </Text>
              </View>
            </View>

            {/* Acknowledgment & Sign-off Action (if not accepted) */}
            {!isPolicyAccepted ? (
              <View style={[styles.signOffBox, isDarkMode && styles.nestedSubBoxDark]}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setHasCheckedAgreement((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, hasCheckedAgreement && styles.checkboxChecked]}>
                    {hasCheckedAgreement && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={[styles.checkboxLabel, isDarkMode && styles.textWhite]}>
                    I confirm I have read, understood, and accept my operational liabilities, job description, payment terms, and Wakulima Market standards as {role === 'MERCHANT' ? 'Master' : 'Sales Agent'}.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.acceptPolicyBtn,
                    !hasCheckedAgreement && styles.acceptPolicyBtnDisabled,
                  ]}
                  onPress={handleAcceptPolicy}
                  disabled={!hasCheckedAgreement}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-done-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.acceptPolicyBtnText}>
                    Accept & Sign Operational Agreement
                  </Text>
                </TouchableOpacity>

                {/* Minimize / Close Button without signing */}
                <TouchableOpacity
                  style={[styles.closePolicyActionBtn, isDarkMode && styles.closePolicyActionBtnDark]}
                  onPress={() => setIsPolicyExpanded(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-up" size={15} color={isDarkMode ? '#CFE9EC' : '#64748B'} />
                  <Text style={[styles.closePolicyActionBtnText, isDarkMode && styles.textMutedDark]}>
                    Close / Minimize Terms & SOP (Review Later)
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={[styles.resignedNoteRow, isDarkMode && styles.nestedSubBoxDark]}>
                  <Ionicons name="shield-checkmark" size={14} color={isDarkMode ? '#CFE9EC' : '#059669'} />
                  <Text style={[styles.resignedNoteText, isDarkMode && styles.textMutedDark]}>
                    Agreement signed and legally acknowledged by {currentUserName}.
                  </Text>
                </View>

                {/* Minimize / Close Button for approved state */}
                <TouchableOpacity
                  style={[styles.closePolicyActionBtn, isDarkMode && styles.closePolicyActionBtnDark]}
                  onPress={() => setIsPolicyExpanded(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-up" size={15} color={isDarkMode ? '#CFE9EC' : '#64748B'} />
                  <Text style={[styles.closePolicyActionBtnText, isDarkMode && styles.textMutedDark]}>
                    Close / Minimize Terms & SOP
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* 3. Truck Stay Day Setting & Governance (MASTER ONLY) */}
      {role === 'MERCHANT' && currentBatch && (
        <View style={[styles.metricCard, isDarkMode && styles.profileCardDark]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, isDarkMode && styles.textWhite]}>
              TRUCK STAY & DAY SETTING
            </Text>
            <View style={[styles.truckPlateBadge, isDarkMode && styles.truckPlateBadgeDark]}>
              <Text style={[styles.truckPlateText, isDarkMode && styles.textWhite]}>
                {currentBatch.truckPlate}
              </Text>
            </View>
          </View>

          <Text style={[styles.cardSubtitle, isDarkMode && styles.textSubtleDark]}>
            Wakulima Market limit: 4 days standard stay (Day 5 negotiated extension).
          </Text>

          {/* Day selection pills */}
          <View style={styles.daySelectorRow}>
            {[1, 2, 3, 4, 5].map((d) => {
              const isActive = currentBatch.dayNumber === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.dayPill,
                    isDarkMode && styles.dayPillDark,
                    isActive && (isDarkMode ? styles.dayPillActiveDark : styles.dayPillActive),
                    d === 5 && !isActive && (isDarkMode ? styles.dayPillExtDark : styles.dayPillExt),
                    d === 5 && isActive && styles.dayPillExtActive,
                  ]}
                  onPress={() => handleDaySelect(d)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dayPillText,
                      isDarkMode && styles.textMutedDark,
                      isActive && styles.dayPillTextActive,
                      d === 5 && !isActive && { color: isDarkMode ? '#FECACA' : '#DC2626' },
                    ]}
                  >
                    {d === 5 ? 'Day 5 (Ext)' : `Day ${d}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.dayPolicyExplanation, isDarkMode && styles.nestedSubBoxDark]}>
            <Ionicons name="information-circle-outline" size={15} color={isDarkMode ? '#CFE9EC' : '#0891B2'} />
            <Text style={[styles.dayPolicyExplanationText, isDarkMode && styles.textMutedDark]}>
              {currentBatch.dayNumber === 1
                ? 'Currently on Day 1: Initial base County Cess applied with net count.'
                : currentBatch.dayNumber === 5
                ? 'Currently on Day 5: Negotiated extension with flat Ksh 1,000 demurrage.'
                : `Currently on Day ${currentBatch.dayNumber} of 4: Flat Ksh 1,000 daily fee (No net recount by inspectors).`}
            </Text>
          </View>
        </View>
      )}

      {/* 3B. Seller Assigned Stock Custody & Physical Count Verification (Single Source of Truth) */}
      {role === 'SELLER' && sellerAllocation && (
        <View style={[styles.metricCard, isDarkMode && styles.profileCardDark]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, isDarkMode && styles.textWhite]}>
              ASSIGNED STOCK (SINGLE SOURCE OF TRUTH)
            </Text>
            <View
              style={[
                styles.statusPillBadge,
                sellerAllocation.acknowledgmentStatus === 'ACKNOWLEDGED' && styles.statusPillGreen,
                sellerAllocation.acknowledgmentStatus === 'DISCREPANCY' && styles.statusPillRed,
                (!sellerAllocation.acknowledgmentStatus || sellerAllocation.acknowledgmentStatus === 'PENDING') &&
                  styles.statusPillAmber,
              ]}
            >
              <Text style={styles.statusPillBadgeText}>
                {sellerAllocation.acknowledgmentStatus === 'ACKNOWLEDGED'
                  ? 'VERIFIED & RECEIVED'
                  : sellerAllocation.acknowledgmentStatus === 'DISCREPANCY'
                  ? 'DISCREPANCY FLAGGED'
                  : 'AWAITING YOUR COUNT'}
              </Text>
            </View>
          </View>

          <Text style={[styles.cardSubtitle, isDarkMode && styles.textSubtleDark]}>
            Assigned from Batch {currentBatch?.batchNumber || 'WB-20261022-01'} ({currentBatch?.truckPlate || 'KDE 421B'}). Verify physical net count before commencing sales.
          </Text>

          {/* Quota breakdown */}
          <View style={styles.quotaGrid}>
            <View style={[styles.quotaBox, isDarkMode && styles.quotaBoxDark]}>
              <Text style={[styles.quotaBoxLabel, isDarkMode && styles.textSubtleDark]}>
                GRADE 1 (TARGET KSH {sellerAllocation.expectedPriceG1 || 1300})
              </Text>
              <Text style={[styles.quotaBoxValue, { color: isDarkMode ? '#F0FDFA' : '#0891B2' }]}>
                {sellerAllocation.grade1Allocated}{' '}
                <Text style={[styles.quotaBoxUnit, isDarkMode && styles.textSubtleDark]}>nets</Text>
              </Text>
              {sellerAllocation.acknowledgmentStatus === 'DISCREPANCY' && (
                <Text style={styles.reportedDiscrepancyText}>
                  Counted: {sellerAllocation.physicalCountGrade1 ?? sellerAllocation.grade1Allocated} nets
                </Text>
              )}
            </View>

            <View style={[styles.quotaBox, isDarkMode && styles.quotaBoxDark]}>
              <Text style={[styles.quotaBoxLabel, isDarkMode && styles.textSubtleDark]}>
                GRADE 2 (TARGET KSH {sellerAllocation.expectedPriceG2 || 800})
              </Text>
              <Text style={[styles.quotaBoxValue, { color: isDarkMode ? '#F0FDFA' : '#D97706' }]}>
                {sellerAllocation.grade2Allocated}{' '}
                <Text style={[styles.quotaBoxUnit, isDarkMode && styles.textSubtleDark]}>nets</Text>
              </Text>
              {sellerAllocation.acknowledgmentStatus === 'DISCREPANCY' && (
                <Text style={styles.reportedDiscrepancyText}>
                  Counted: {sellerAllocation.physicalCountGrade2 ?? sellerAllocation.grade2Allocated} nets
                </Text>
              )}
            </View>
          </View>

          {/* Allocation Status & Action Buttons */}
          {sellerAllocation.acknowledgmentStatus === 'ACKNOWLEDGED' ? (
            <View style={styles.verifiedBox}>
              <Ionicons name="checkmark-done-circle" size={18} color="#059669" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.verifiedBoxTitle}>Stock Custody Formally Acknowledged</Text>
                <Text style={styles.verifiedBoxSub}>
                  You verified and accepted physical custody of {sellerAllocation.grade1Allocated + sellerAllocation.grade2Allocated} nets. Any unrecorded loss will be resolved against sales receipts.
                </Text>
              </View>
            </View>
          ) : sellerAllocation.acknowledgmentStatus === 'DISCREPANCY' ? (
            <View style={styles.discrepancyBox}>
              <Ionicons name="warning" size={18} color="#DC2626" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.discrepancyBoxTitle}>Discrepancy Sent to Master Admin</Text>
                <Text style={styles.discrepancyBoxSub}>
                  Reason: "{sellerAllocation.discrepancyNote || 'Count mismatch'}"
                </Text>
                <TouchableOpacity
                  style={styles.reReportBtn}
                  onPress={handleOpenDiscrepancyModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.reReportBtnText}>Update Physical Count</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.pendingActionBox}>
              <Text style={styles.pendingActionPrompt}>
                Physical bay verification: Does your physical count match the {sellerAllocation.grade1Allocated + sellerAllocation.grade2Allocated} nets assigned above?
              </Text>
              <View style={styles.stockActionRow}>
                <TouchableOpacity
                  style={styles.ackStockBtn}
                  onPress={handleAcknowledgeStock}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.ackStockBtnText}>Acknowledge Stock</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.discrepancyBtn}
                  onPress={handleOpenDiscrepancyModal}
                  activeOpacity={0.8}
                >
                  <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                  <Text style={styles.discrepancyBtnText}>Raise Discrepancy</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* 3b. Self-Hosted Android SIM SMS Setup (Master & Seller Android) */}
      {Platform.OS === 'android' && (
        <View style={[styles.metricCard, isDarkMode && styles.profileCardDark]}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.cardTitle, isDarkMode && styles.textWhite]}>
                SIM SMS SETUP (THIS PHONE)
              </Text>
              <Text style={[styles.sellerPhone, isDarkMode && styles.textSubtleDark, { marginTop: 2 }]}>
                {role === 'MERCHANT'
                  ? 'Send payment details, purchase receipts, credit agreements, and OTPs directly from your SIM (KES 0 API fee).'
                  : 'Use your phone SIM to send customer receipts, credit agreements, and final Day Closure SMS to Master.'}
                {simSmsSentCount > 0 ? ` Sent this session: ${simSmsSentCount}` : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={async () => {
                if (simSmsGatewayEnabled) {
                  setSimSmsGatewayEnabled(false);
                  return;
                }
                const granted = await ensureSimSmsPermissions();
                if (granted) {
                  setSimSmsGatewayEnabled(true);
                  const sims = await listActiveSims();
                  setActiveSims(sims);
                  if (sims.length > 0 && selectedSimSubId === null) {
                    const def = sims.find((s) => s.isDefaultSmsSim) ?? sims[0];
                    setSelectedSimSubId(def.subscriptionId);
                  }
                  Alert.alert('SIM SMS Gateway Active', 'Queued & Pochi SMS will be sent using your attached SIM.');
                } else {
                  Alert.alert('Permission Required', 'Grant SEND_SMS and Phone permissions to enable the SIM SMS Gateway.');
                }
              }}
              activeOpacity={0.85}
              style={{
                backgroundColor: simSmsGatewayEnabled ? '#10B981' : (isDarkMode ? '#1B4F55' : '#E2E8F0'),
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color: simSmsGatewayEnabled ? '#FFFFFF' : (isDarkMode ? '#CFE9EC' : '#334155'),
                }}
              >
                {simSmsGatewayEnabled ? 'ACTIVE' : 'ENABLE'}
              </Text>
            </TouchableOpacity>
          </View>

          {simSmsGatewayEnabled && (
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: isDarkMode ? '#1B4F55' : '#E2E8F0', gap: 10 }}>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: isDarkMode ? '#5EEAD4' : '#0F766E' }}>
                  1. CHOOSE THE SIM YOU WANT TO USE TO SEND SMS
                </Text>
                <Text style={{ fontSize: 11, color: isDarkMode ? '#9AC7CC' : '#64748B' }}>
                  Tap a SIM card below to attach it for all outgoing SMS from this phone.
                </Text>
                {activeSims.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                    {activeSims.map((sim) => {
                      const active = selectedSimSubId === sim.subscriptionId || (selectedSimSubId === null && sim.isDefaultSmsSim);
                      return (
                        <TouchableOpacity
                          key={sim.subscriptionId}
                          onPress={() => setSelectedSimSubId(sim.subscriptionId)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 7,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: active ? '#0D9488' : (isDarkMode ? '#1B4F55' : '#CBD5E1'),
                            backgroundColor: active ? '#0D9488' : (isDarkMode ? '#12383D' : '#F1F5F9'),
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '800', color: active ? '#FFFFFF' : (isDarkMode ? '#CFE9EC' : '#334155') }}>
                            SIM {sim.slotIndex + 1}: {sim.carrierName}
                            {sim.phoneNumber ? ` (${sim.phoneNumber})` : ''}
                            {active ? ' • SELECTED' : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={{ fontSize: 11, color: isDarkMode ? '#CFE9EC' : '#475569' }}>
                    Using phone&apos;s default SIM (grant Phone permission if dual-SIM slots do not appear).
                  </Text>
                )}
              </View>

              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: isDarkMode ? '#5EEAD4' : '#0F766E' }}>
                  2. PAYMENT RECEIVING NUMBER (POCHI / M-PESA)
                </Text>
                <Text style={{ fontSize: 11, color: isDarkMode ? '#9AC7CC' : '#64748B' }}>
                  Which number customer payments are made to (included in payment SMS).
                </Text>
                <TextInput
                  key="sim-pochi-input"
                  value={pochiPhoneNumber}
                  onChangeText={setPochiPhoneNumber}
                  keyboardType="phone-pad"
                  autoComplete="off"
                  importantForAutofill="no"
                  placeholder="0115148000"
                  placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: isDarkMode ? '#FFFFFF' : '#0F172A',
                    backgroundColor: isDarkMode ? '#12383D' : '#F8FAFC',
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                  }}
                />
              </View>

              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: isDarkMode ? '#5EEAD4' : '#0F766E' }}>
                  3. MASTER&apos;S PHONE NUMBER (FOR DAY CLOSURE SMS)
                </Text>
                <Text style={{ fontSize: 11, color: isDarkMode ? '#9AC7CC' : '#64748B' }}>
                  Final Day Closure receipt SMS will be sent to this Master phone number.
                </Text>
                <TextInput
                  key="sim-master-input"
                  value={masterPhoneNumber}
                  onChangeText={setMasterPhoneNumber}
                  keyboardType="phone-pad"
                  autoComplete="off"
                  importantForAutofill="no"
                  placeholder={role === 'MERCHANT' && currentUserPhone ? currentUserPhone : 'e.g. 0712345678'}
                  placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: isDarkMode ? '#FFFFFF' : '#0F172A',
                    backgroundColor: isDarkMode ? '#12383D' : '#F8FAFC',
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                  }}
                />
              </View>

              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: isDarkMode ? '#5EEAD4' : '#0F766E' }}>
                  4. TEST ATTACHED SIM
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    key="sim-test-input"
                    value={testSmsPhone}
                    onChangeText={setTestSmsPhone}
                    keyboardType="phone-pad"
                    autoComplete="off"
                    importantForAutofill="no"
                    placeholder="Test phone (e.g. 0712345678)"
                    placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                    style={{
                      flex: 1,
                      fontSize: 12,
                      color: isDarkMode ? '#FFFFFF' : '#0F172A',
                      backgroundColor: isDarkMode ? '#12383D' : '#F8FAFC',
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                    }}
                  />
                  <TouchableOpacity
                    disabled={sendingTestSms}
                    onPress={async () => {
                      const target = testSmsPhone.trim();
                      if (target.replace(/\D/g, '').length < 9) {
                        Alert.alert('Phone Required', 'Enter a valid phone number to send a test SMS.');
                        return;
                      }
                      setSendingTestSms(true);
                      try {
                        await sendDirectSimSms(
                          target,
                          `Hello from The Gem! Make your payment via ${pochiPhoneNumber || '0115148000'} using Pochi la Biashara.`,
                          selectedSimSubId
                        );
                        incrementSimSmsSent();
                        Alert.alert('Test SMS Sent', `Dispatched directly from attached SIM to ${target}.`);
                      } catch (err) {
                        Alert.alert('SIM Send Failed', err instanceof Error ? err.message : 'Failed to send SMS');
                      } finally {
                        setSendingTestSms(false);
                      }
                    }}
                    style={{
                      backgroundColor: '#0284C7',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      opacity: sendingTestSms ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>
                      {sendingTestSms ? 'SENDING...' : 'TEST SMS'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* 4. Seller Team & Quota Delegation (Master view) */}
      {role === 'MERCHANT' && (
        <View style={[styles.metricCard, isDarkMode && styles.profileCardDark]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, isDarkMode && styles.textWhite]}>
              SELLER ASSIGNMENT & QUOTAS
            </Text>
            <TouchableOpacity
              style={styles.assignNewBtn}
              onPress={onOpenSellerModal}
              activeOpacity={0.8}
            >
              <Ionicons name="person-add" size={13} color="#FFFFFF" />
              <Text style={styles.assignNewBtnText}>Assign Seller</Text>
            </TouchableOpacity>
          </View>

          {allocations.length > 0 ? (
            <View style={styles.sellerList}>
              {allocations.map((alloc) => (
                <View
                  key={alloc.id}
                  style={[styles.sellerItem, isDarkMode && styles.sellerItemDark]}
                >
                  <View style={styles.sellerItemLeft}>
                    <View style={[styles.sellerAvatarIcon, isDarkMode && styles.sellerAvatarIconDark]}>
                      <Ionicons name="person" size={14} color={isDarkMode ? '#F0FDFA' : '#059669'} />
                    </View>
                    <View>
                      <Text style={[styles.sellerName, isDarkMode && styles.textWhite]}>
                        {alloc.sellerName}
                      </Text>
                      <Text style={[styles.sellerPhone, isDarkMode && styles.textSubtleDark]}>
                        {alloc.sellerPhone}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.sellerItemRight, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                    <Text style={[styles.sellerQuotaText, isDarkMode && styles.textMutedDark]}>
                      G1: {alloc.grade1Allocated} • G2: {alloc.grade2Allocated}
                    </Text>
                    <TouchableOpacity
                      onPress={() => confirmAndRevokeAssignment(alloc, revokeSellerAssignment)}
                      activeOpacity={0.8}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 3,
                        backgroundColor: isDarkMode ? '#3B181C' : '#FEF2F2',
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#EF4444' : '#FECACA',
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: 8,
                      }}
                    >
                      <Ionicons name="return-down-back" size={12} color="#EF4444" />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#EF4444' }}>Revoke</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.noSellersText, isDarkMode && styles.textSubtleDark]}>
              No hired sellers assigned for today's truck.
            </Text>
          )}
        </View>
      )}

      {/* 5. Credited Persons & Ledger Overview */}
      <View style={[styles.metricCard, isDarkMode && styles.profileCardDark]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, isDarkMode && styles.textWhite]}>
            CREDITED PERSONS (DEBTORS)
          </Text>
          <TouchableOpacity onPress={onOpenCreditLedger}>
            <Text style={[styles.viewLedgerLink, isDarkMode && styles.textMutedDark]}>
              View Full Ledger ➔
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.debtMetricsGrid}>
          <View style={[styles.debtBox, isDarkMode && styles.debtBoxDark]}>
            <Text style={[styles.debtLabel, isDarkMode && styles.textSubtleDark]}>
              REGISTERED DEBTORS
            </Text>
            <Text style={[styles.debtValue, isDarkMode && styles.textWhite]}>
              {totalDebtors} Persons
            </Text>
          </View>
          <View style={[styles.debtBox, isDarkMode && styles.debtBoxDark]}>
            <Text style={[styles.debtLabel, isDarkMode && styles.textSubtleDark]}>
              TOTAL STORE CREDIT
            </Text>
            <Text style={[styles.debtValue, isDarkMode ? styles.textWhite : { color: '#DC2626' }]}>
              Ksh {totalOutstandingCredit.toLocaleString()}
            </Text>
          </View>
        </View>

        {pendingApprovals > 0 && (
          <View style={[styles.pendingAlertBox, isDarkMode && styles.nestedSubBoxDark]}>
            <Ionicons name="time" size={14} color={isDarkMode ? '#CFE9EC' : '#D97706'} />
            <Text style={[styles.pendingAlertText, isDarkMode && styles.textMutedDark]}>
              {pendingApprovals} credit sale request(s) waiting for Master sign-off.
            </Text>
          </View>
        )}
      </View>

      {/* 6. Accepted Modes of Payment Configuration */}
      <View style={[styles.metricCard, isDarkMode && styles.profileCardDark]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, isDarkMode && styles.textWhite]}>
            STORE MODES OF PAYMENT
          </Text>
        </View>
        {role === 'MERCHANT' && (
          <Text style={[styles.cardSubtitle, isDarkMode && styles.textSubtleDark]}>
            Tap any mode to enable or disable it for store sales
          </Text>
        )}

        <View style={styles.paymentMethodsList}>
          {/* M-Pesa Till */}
          <TouchableOpacity
            disabled={role !== 'MERCHANT'}
            onPress={() => handleTogglePaymentMode('MPESA')}
            activeOpacity={0.8}
            style={[
              styles.paymentMethodRow,
              isDarkMode && styles.paymentMethodRowDark,
              !paymentModes.MPESA && styles.paymentMethodRowInactive,
            ]}
          >
            <View style={[styles.paymentIconCircle, isDarkMode && styles.paymentIconCircleDark]}>
              <Ionicons name="phone-portrait" size={16} color={isDarkMode ? '#F0FDFA' : '#059669'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.paymentName, isDarkMode && styles.textWhite]}>
                M-Pesa Buy Goods Till
              </Text>
              <Text style={[styles.paymentDetails, isDarkMode && styles.textSubtleDark]}>
                Till No: 981244 ({storeName || 'NKACE Enterprise'}) • Instant SMS verification
              </Text>
            </View>
            <View
              style={[
                styles.statusActivePill,
                paymentModes.MPESA
                  ? (isDarkMode ? styles.statusPillActiveDark : styles.statusPillActiveLight)
                  : (isDarkMode ? styles.statusPillDark : styles.statusPillInactiveLight),
              ]}
            >
              <Text
                style={[
                  styles.statusActiveText,
                  paymentModes.MPESA
                    ? (isDarkMode ? { color: '#FDE68A' } : { color: '#92400E' })
                    : (isDarkMode ? styles.textSubtleDark : { color: '#64748B' }),
                ]}
              >
                {paymentModes.MPESA ? 'ACTIVE' : 'DISABLED'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Cash Drawer */}
          <TouchableOpacity
            disabled={role !== 'MERCHANT'}
            onPress={() => handleTogglePaymentMode('CASH')}
            activeOpacity={0.8}
            style={[
              styles.paymentMethodRow,
              isDarkMode && styles.paymentMethodRowDark,
              !paymentModes.CASH && styles.paymentMethodRowInactive,
            ]}
          >
            <View style={[styles.paymentIconCircle, isDarkMode ? styles.paymentIconCircleDark : { backgroundColor: '#ECFEFF' }]}>
              <MaterialCommunityIcons name="cash-multiple" size={16} color={isDarkMode ? '#F0FDFA' : '#0891B2'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.paymentName, isDarkMode && styles.textWhite]}>
                Physical Cash Drawer
              </Text>
              <Text style={[styles.paymentDetails, isDarkMode && styles.textSubtleDark]}>
                Marikiti Stall Cash Register • 14:00 COB reconciliation
              </Text>
            </View>
            <View
              style={[
                styles.statusActivePill,
                paymentModes.CASH
                  ? (isDarkMode ? styles.statusPillActiveDark : styles.statusPillActiveLight)
                  : (isDarkMode ? styles.statusPillDark : styles.statusPillInactiveLight),
              ]}
            >
              <Text
                style={[
                  styles.statusActiveText,
                  paymentModes.CASH
                    ? (isDarkMode ? { color: '#FDE68A' } : { color: '#92400E' })
                    : (isDarkMode ? styles.textSubtleDark : { color: '#64748B' }),
                ]}
              >
                {paymentModes.CASH ? 'ACTIVE' : 'DISABLED'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 4-Day Supervised Credit */}
          <TouchableOpacity
            disabled={role !== 'MERCHANT'}
            onPress={() => handleTogglePaymentMode('CREDIT')}
            activeOpacity={0.8}
            style={[
              styles.paymentMethodRow,
              isDarkMode && styles.paymentMethodRowDark,
              !paymentModes.CREDIT && styles.paymentMethodRowInactive,
            ]}
          >
            <View style={[styles.paymentIconCircle, isDarkMode ? styles.paymentIconCircleDark : { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="time" size={16} color={isDarkMode ? '#F0FDFA' : '#D97706'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.paymentName, isDarkMode && styles.textWhite]}>
                Controlled Market Credit (Deni)
              </Text>
              <Text style={[styles.paymentDetails, isDarkMode && styles.textSubtleDark]}>
                Max 4-day settlement • Debtor SMS consent mandatory
              </Text>
            </View>
            <View
              style={[
                styles.statusActivePill,
                paymentModes.CREDIT
                  ? (isDarkMode ? styles.statusPillActiveDark : styles.statusPillActiveLight)
                  : (isDarkMode ? styles.statusPillDark : styles.statusPillInactiveLight),
              ]}
            >
              <Text
                style={[
                  styles.statusActiveText,
                  paymentModes.CREDIT
                    ? (isDarkMode ? { color: '#FDE68A' } : { color: '#92400E' })
                    : (isDarkMode ? styles.textSubtleDark : { color: '#64748B' }),
                ]}
              >
                {paymentModes.CREDIT ? 'ACTIVE' : 'DISABLED'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* 7. Logout Action */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.logoutBtn, isDarkMode && styles.logoutBtnDark]}
          onPress={onLogout}
          activeOpacity={0.8}
        >
          <Ionicons
            name="log-out-outline"
            size={18}
            color={isDarkMode ? '#FDE68A' : '#B91C1C'}
          />
          <Text style={[styles.logoutBtnText, isDarkMode && { color: '#FDE68A' }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>

      {/* 8. Discrepancy Reporting Modal for Seller */}
      <Modal
        visible={showDiscrepancyModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDiscrepancyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.discrepancyModalCard, isDarkMode && styles.discrepancyModalCardDark]}>
            <View style={[styles.discrepancyModalHeader, isDarkMode && styles.editFormHeaderDark]}>
              <Text style={[styles.discrepancyModalTitle, isDarkMode && styles.textWhite]}>
                Raise Stock Discrepancy
              </Text>
              <TouchableOpacity onPress={() => setShowDiscrepancyModal(false)}>
                <Ionicons name="close" size={22} color={isDarkMode ? '#CFE9EC' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.discrepancyModalSubtitle, isDarkMode && styles.textSubtleDark]}>
              Enter actual physical count observed at the Marikiti bay. A high-priority alert will be sent immediately to the Master.
            </Text>

            <View style={styles.modalFormGroup}>
              <Text style={[styles.formLabel, isDarkMode && styles.textMutedDark]}>
                Grade 1 Physical Nets Count:
              </Text>
              <TextInput
                style={[styles.formInput, isDarkMode && styles.formInputDark]}
                keyboardType="numeric"
                value={reportedG1}
                onChangeText={setReportedG1}
                placeholder="e.g. 48"
                placeholderTextColor={isDarkMode ? '#8EC2C8' : '#94A3B8'}
              />
            </View>

            <View style={styles.modalFormGroup}>
              <Text style={[styles.formLabel, isDarkMode && styles.textMutedDark]}>
                Grade 2 Physical Nets Count:
              </Text>
              <TextInput
                style={[styles.formInput, isDarkMode && styles.formInputDark]}
                keyboardType="numeric"
                value={reportedG2}
                onChangeText={setReportedG2}
                placeholder="e.g. 28"
                placeholderTextColor={isDarkMode ? '#8EC2C8' : '#94A3B8'}
              />
            </View>

            <View style={styles.modalFormGroup}>
              <Text style={[styles.formLabel, isDarkMode && styles.textMutedDark]}>
                Discrepancy Reason / Note:
              </Text>
              <TextInput
                style={[styles.formInput, styles.formInputMultiline, isDarkMode && styles.formInputDark]}
                multiline
                numberOfLines={3}
                value={discrepancyReason}
                onChangeText={setDiscrepancyReason}
                placeholder="e.g. 2 nets split open during offloading; 2 nets short from truck stack."
                placeholderTextColor={isDarkMode ? '#8EC2C8' : '#94A3B8'}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.cancelModalBtn, isDarkMode && styles.cancelModalBtnDark]}
                onPress={() => setShowDiscrepancyModal(false)}
              >
                <Text style={[styles.cancelModalBtnText, isDarkMode && styles.textMutedDark]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitDiscrepancyBtn}
                onPress={handleSubmitDiscrepancy}
              >
                <Ionicons name="paper-plane" size={15} color="#FFFFFF" />
                <Text style={styles.submitDiscrepancyBtnText}>Send Alert to Master</Text>
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
    paddingTop: 8,
    paddingBottom: 24,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  profileCardDark: {
    backgroundColor: '#256A71',
    shadowColor: '#0D2C30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrapper: {
    width: '25%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileDetails: {
    flex: 1,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleMerchant: {
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#A5F3FC',
  },
  roleSeller: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0891B2',
    letterSpacing: 0.5,
  },
  locationPill: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  storeHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  adminNameSub: {
    fontSize: 13,
    color: '#0891B2',
    marginTop: 2,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  editPencilBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  editPencilText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0891B2',
  },
  editMasterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  editMasterBtnDark: {
    backgroundColor: '#1B4F55',
    borderColor: 'rgba(122, 181, 188, 0.5)',
    borderWidth: 0.75,
  },
  editMasterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0891B2',
  },
  userContact: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  nameInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    color: '#0F172A',
  },
  nameInputDark: {
    backgroundColor: '#1D575D',
    borderColor: '#7AB5BC',
    color: '#F0FDFA',
  },
  saveNameBtn: {
    backgroundColor: '#0891B2',
    padding: 6,
    borderRadius: 6,
  },
  cancelNameBtn: {
    backgroundColor: '#F1F5F9',
    padding: 6,
    borderRadius: 6,
  },

  // Master Edit Form Styles
  editFormBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginTop: 12,
  },
  editFormBoxDark: {
    backgroundColor: '#1B4F55',
    borderColor: 'rgba(122, 181, 188, 0.45)',
    borderWidth: 0.75,
  },
  editFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  editFormHeaderDark: {
    borderBottomColor: 'rgba(122, 181, 188, 0.35)',
  },
  editFormTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  formGroup: {
    marginBottom: 8,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 3,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0F172A',
  },
  formInputDark: {
    backgroundColor: '#1D575D',
    borderColor: '#7AB5BC',
    color: '#F0FDFA',
  },
  formHelper: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  formActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  cancelFormBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  cancelFormBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  saveFormBtn: {
    flex: 2,
    backgroundColor: '#0891B2',
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  saveFormBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Policy Section Styles
  policyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  policyCardDark: {
    backgroundColor: '#256A71',
    shadowColor: '#0D2C30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  policyCardPending: {
    borderColor: '#FDE68A',
    borderWidth: 1.5,
  },
  policyHeaderTouchable: {
    paddingVertical: 2,
  },
  policyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  policyCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  policyCardSubminimized: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  togglePolicyBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    marginLeft: 6,
  },
  togglePolicyBtnDark: {
    backgroundColor: '#1B4F55',
    borderWidth: 0.75,
    borderColor: 'rgba(122, 181, 188, 0.45)',
  },
  togglePolicyBtnExpanded: {
    backgroundColor: '#E2E8F0',
  },
  togglePolicyBtnExpandedDark: {
    backgroundColor: '#184C52',
    borderWidth: 0.75,
    borderColor: '#7AB5BC',
  },
  togglePolicyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0891B2',
  },
  acceptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    padding: 8,
    borderRadius: 6,
    marginTop: 10,
  },
  acceptedBannerText: {
    fontSize: 10,
    color: '#065F46',
    fontWeight: '600',
    flex: 1,
  },
  pendingPromptBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 6,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingPromptBannerDark: {
    backgroundColor: '#1B4F55',
    borderColor: '#FDE68A',
    borderWidth: 0.75,
  },
  pendingPromptBannerText: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '700',
    flex: 1,
  },
  policyContentContainer: {
    marginTop: 12,
  },
  policySectionBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  policySectionBlockDark: {
    backgroundColor: '#1B4F55',
    borderWidth: 0.75,
    borderColor: 'rgba(122, 181, 188, 0.4)',
  },
  nestedSubBoxDark: {
    backgroundColor: '#164247',
    borderWidth: 0.75,
    borderColor: 'rgba(122, 181, 188, 0.4)',
  },
  policySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  policySectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.3,
  },
  bulletList: {
    gap: 5,
  },
  bulletItem: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 15,
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  salaryRangeBox: {
    backgroundColor: '#ECFDF5',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  salaryRangeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  salaryRangeValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
    marginTop: 1,
  },
  salaryRangeSubtext: {
    fontSize: 9,
    color: '#047857',
    marginTop: 1,
  },
  masterLedgerNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#A5F3FC',
    padding: 8,
    borderRadius: 6,
  },
  masterLedgerNoticeTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0891B2',
    letterSpacing: 0.5,
  },
  masterLedgerNoticeDesc: {
    fontSize: 10,
    color: '#0E7490',
    lineHeight: 14,
    marginTop: 2,
  },
  signOffBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  checkboxLabel: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
    lineHeight: 15,
  },
  acceptPolicyBtn: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 6,
  },
  acceptPolicyBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  acceptPolicyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  resignedNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
  },
  resignedNoteText: {
    fontSize: 10,
    color: '#065F46',
    fontWeight: '600',
  },
  closePolicyActionBtn: {
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
  },
  closePolicyActionBtnDark: {
    backgroundColor: '#1B4F55',
    borderColor: 'rgba(122, 181, 188, 0.45)',
    borderWidth: 0.75,
  },
  closePolicyActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },

  // Metric Card & Common Card Styles
  metricCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
  },
  truckPlateBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  truckPlateBadgeDark: {
    backgroundColor: '#1B4F55',
    borderWidth: 0.75,
    borderColor: 'rgba(122, 181, 188, 0.45)',
  },
  truckPlateText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  daySelectorRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 6,
  },
  dayPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  dayPillDark: {
    backgroundColor: '#1B4F55',
    borderWidth: 0.75,
    borderColor: 'rgba(122, 181, 188, 0.4)',
  },
  dayPillActive: {
    backgroundColor: '#0891B2',
  },
  dayPillActiveDark: {
    backgroundColor: '#0D9488',
    borderWidth: 0.75,
    borderColor: '#99F6E4',
  },
  dayPillExt: {
    backgroundColor: '#FEF2F2',
  },
  dayPillExtDark: {
    backgroundColor: '#3B2328',
    borderWidth: 0.75,
    borderColor: 'rgba(252, 165, 165, 0.4)',
  },
  dayPillExtActive: {
    backgroundColor: '#DC2626',
  },
  dayPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  dayPillTextActive: {
    color: '#FFFFFF',
  },
  dayPolicyExplanation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFEFF',
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  dayPolicyExplanationText: {
    fontSize: 10,
    color: '#0E7490',
    flex: 1,
    lineHeight: 13,
  },

  // Seller Delegation
  assignNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  assignNewBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sellerList: {
    gap: 6,
    marginTop: 6,
  },
  sellerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
  },
  sellerItemDark: {
    backgroundColor: '#1B4F55',
    borderWidth: 0.75,
    borderColor: 'rgba(122, 181, 188, 0.4)',
  },
  sellerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sellerAvatarIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerAvatarIconDark: {
    backgroundColor: '#164247',
  },
  sellerName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  sellerPhone: {
    fontSize: 10,
    color: '#64748B',
  },
  sellerItemRight: {
    alignItems: 'flex-end',
  },
  sellerQuotaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  noSellersText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Debtor Overview
  viewLedgerLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0891B2',
  },
  debtMetricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
  },
  debtBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
  },
  debtBoxDark: {
    backgroundColor: '#1B4F55',
    borderWidth: 0.75,
    borderColor: 'rgba(122, 181, 188, 0.4)',
  },
  debtLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  debtValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  pendingAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    padding: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  pendingAlertText: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '600',
  },

  // Payment Methods
  paymentMethodsList: {
    gap: 6,
    marginTop: 8,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
  },
  paymentMethodRowDark: {
    backgroundColor: '#1B4F55',
    borderWidth: 0.75,
    borderColor: 'rgba(122, 181, 188, 0.4)',
  },
  paymentMethodRowActive: {
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  paymentMethodRowActiveDark: {
    borderWidth: 0.75,
    borderColor: '#FDE68A',
  },
  paymentMethodRowInactive: {
    opacity: 0.6,
  },
  paymentIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentIconCircleDark: {
    backgroundColor: '#164247',
  },
  paymentName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  paymentDetails: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  statusActivePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPillActiveLight: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusPillActiveDark: {
    backgroundColor: '#256A71',
    borderWidth: 0.75,
    borderColor: '#FDE68A',
  },
  statusPillInactiveLight: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusPillDark: {
    backgroundColor: '#164247',
    borderWidth: 0.75,
    borderColor: 'rgba(122, 181, 188, 0.45)',
  },
  statusActiveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },

  // Logout Action
  actionsContainer: {
    marginTop: 8,
  },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 0.75,
    borderColor: '#FECACA',
    paddingVertical: 13,
    borderRadius: 24,
  },
  logoutBtnDark: {
    backgroundColor: '#256A71',
    borderColor: '#FDE68A',
    borderWidth: 0.75,
  },
  logoutBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#B91C1C',
  },

  // General Helpers
  textWhite: {
    color: '#F0FDFA',
  },
  textMutedDark: {
    color: '#CFE9EC',
  },
  textSubtleDark: {
    color: '#B4D6D9',
  },

  // Locked Seller Credentials
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  lockedBadgeDark: {
    backgroundColor: '#1B4F55',
    borderColor: 'rgba(122, 181, 188, 0.45)',
    borderWidth: 0.75,
  },
  lockedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  sellerRoleSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },

  // Status Pill Badges
  statusPillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillGreen: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusPillRed: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  statusPillAmber: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusPillBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0F172A',
  },

  // Quota Grid
  quotaGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  quotaBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quotaBoxDark: {
    backgroundColor: '#1B4F55',
    borderColor: 'rgba(122, 181, 188, 0.45)',
    borderWidth: 0.75,
  },
  quotaBoxLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 3,
  },
  quotaBoxValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  quotaBoxUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  reportedDiscrepancyText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 3,
  },

  // Verification & Discrepancy Action Boxes
  verifiedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 4,
  },
  verifiedBoxTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#059669',
  },
  verifiedBoxSub: {
    fontSize: 10,
    color: '#065F46',
    marginTop: 1,
    lineHeight: 14,
  },

  discrepancyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 4,
  },
  discrepancyBoxTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  discrepancyBoxSub: {
    fontSize: 10,
    color: '#991B1B',
    marginTop: 1,
    lineHeight: 14,
  },
  reReportBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  reReportBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },

  pendingActionBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 4,
  },
  pendingActionPrompt: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 15,
    marginBottom: 8,
  },
  stockActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ackStockBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#059669',
    paddingVertical: 9,
    borderRadius: 6,
  },
  ackStockBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  discrepancyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 9,
    borderRadius: 6,
  },
  discrepancyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },

  // Discrepancy Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  discrepancyModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  discrepancyModalCardDark: {
    backgroundColor: '#256A71',
    shadowColor: '#0D2C30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  discrepancyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  discrepancyModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  discrepancyModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  discrepancyModalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
    marginBottom: 12,
    lineHeight: 15,
  },
  modalFormGroup: {
    marginBottom: 10,
  },
  formInputMultiline: {
    height: 60,
    textAlignVertical: 'top',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelModalBtnDark: {
    backgroundColor: '#1B4F55',
    borderWidth: 0.75,
    borderColor: 'rgba(122, 181, 188, 0.45)',
  },
  cancelModalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  submitDiscrepancyBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  submitDiscrepancyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
