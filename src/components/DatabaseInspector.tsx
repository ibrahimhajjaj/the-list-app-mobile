import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView, Modal, Alert } from 'react-native';
import { theme } from '../constants/theme';
import { useThemeColors } from '../constants/theme';
import { Database, Copy, Trash2, CopyCheck } from 'lucide-react-native';
import * as SQLite from 'expo-sqlite';
import * as Clipboard from 'expo-clipboard';
import { storage } from '../services/storage';

const db = SQLite.openDatabaseSync('thelistapp.db');

interface TableInfo {
  name: string;
  sql: string;
  rowCount: number;
}

interface TableData {
  [key: string]: any[];
}

export function DatabaseInspector() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tableData, setTableData] = useState<TableData>({});
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [copiedStates, setCopiedStates] = useState<{[key: string]: boolean}>({});
  const colors = useThemeColors();

  const fetchTableInfo = async () => {
    try {
      // Get all tables
      const tablesResult = await db.getAllAsync<{ name: string, sql: string }>(
        "SELECT name, sql FROM sqlite_master WHERE type='table'"
      );

      // Get row count for each table
      const tablesWithCount = await Promise.all(
        tablesResult.map(async (table) => {
          const countResult = await db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM ${table.name}`
          );
          return {
            name: table.name,
            sql: table.sql,
            rowCount: countResult?.count || 0
          };
        })
      );

      setTables(tablesWithCount);
    } catch (error) {
      console.error('Error fetching table info:', error);
    }
  };

  const fetchTableData = async (tableName: string) => {
    try {
      const data = await db.getAllAsync(
        `SELECT * FROM ${tableName} LIMIT 100`
      );
      setTableData(prev => ({ ...prev, [tableName]: data }));
    } catch (error) {
      console.error(`Error fetching data for table ${tableName}:`, error);
    }
  };

  useEffect(() => {
    if (isModalVisible) {
      fetchTableInfo();
    }
  }, [isModalVisible]);

  useEffect(() => {
    if (selectedTable) {
      fetchTableData(selectedTable);
    }
  }, [selectedTable]);

  const handleCopySchema = async (sql: string, key: string = 'all') => {
    try {
      await Clipboard.setStringAsync(sql);
      // Show copied state
      setCopiedStates(prev => ({ ...prev, [key]: true }));
      // Reset after 2 seconds
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (error) {
      console.error('Failed to copy schema:', error);
    }
  };

  const handleCopyAllSchemas = async () => {
    const allSchemas = tables
      .map(table => table.sql)
      .join('\n\n');
    await handleCopySchema(allSchemas, 'all');
  };

  const handleDropTable = async (tableName: string) => {
    Alert.alert(
      'Drop Table',
      `Are you sure you want to drop table "${tableName}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Drop',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.execAsync(`DROP TABLE IF EXISTS ${tableName}`);
              await fetchTableInfo();
              setSelectedTable(null);
              setTableData({});
            } catch (error) {
              console.error(`Failed to drop table ${tableName}:`, error);
              Alert.alert('Error', 'Failed to drop table. Check console for details.');
            }
          }
        }
      ]
    );
  };

  const handleCopyRow = async (row: any) => {
    try {
      await Clipboard.setStringAsync(JSON.stringify(row, null, 2));
      Alert.alert('Success', 'Row data copied to clipboard');
    } catch (error) {
      console.error('Failed to copy row:', error);
      Alert.alert('Error', 'Failed to copy row data');
    }
  };

  const renderTableSchema = (sql: string, tableName: string) => {
    // Format the SQL create statement
    const formattedSQL = sql
      .replace(/CREATE TABLE/i, 'CREATE TABLE\n  ')
      .replace(/\(/g, '(\n    ')
      .replace(/\)/g, '\n  )')
      .replace(/,/g, ',\n    ');

    return (
      <View>
        <View style={styles.schemaHeader}>
          <Text style={[styles.subtitle, { color: colors.foreground }]}>
            Schema:
          </Text>
          <View style={styles.schemaActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.muted }]}
              onPress={() => handleCopySchema(sql, tableName)}
            >
              {copiedStates[tableName] ? (
                <CopyCheck size={16} color={colors.mutedForeground} />
              ) : (
                <Copy size={16} color={colors.mutedForeground} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.destructive }]}
              onPress={() => handleDropTable(tableName)}
            >
              <Trash2 size={16} color={colors.destructiveForeground} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.codeText, { color: colors.foreground }]}>
          {formattedSQL}
        </Text>
      </View>
    );
  };

  const renderTableData = (tableName: string) => {
    const data = tableData[tableName];
    if (!data) return null;

    // Calculate optimal column widths based on content
    const columnWidths = data.length > 0 ? Object.keys(data[0]).reduce((acc, key) => {
      const maxContentLength = Math.max(
        key.length,
        ...data.map(row => {
          const value = row[key];
          return typeof value === 'object' 
            ? JSON.stringify(value).length 
            : String(value).length;
        })
      );
      // Set minimum width of 80px, and max of 300px
      // Each character is roughly 8px wide
      acc[key] = Math.min(Math.max(maxContentLength * 8, 80), 300);
      return acc;
    }, {} as { [key: string]: number }) : {};

    return (
      <View style={styles.tableDataContainer}>
        <Text style={[styles.subtitle, { color: colors.foreground }]}>
          Sample Data (First 100 rows):
        </Text>
        <ScrollView horizontal>
          <View style={styles.tableWrapper}>
            {/* Headers */}
            {data.length > 0 && (
              <View style={[
                styles.tableRow, 
                styles.headerRow,
                { backgroundColor: colors.muted }
              ]}>
                <View style={[styles.tableCell, styles.actionCell]}>
                  <Text style={[styles.tableHeaderCell, { color: colors.primary }]}>
                    Actions
                  </Text>
                </View>
                {Object.keys(data[0]).map((key) => (
                  <View 
                    key={key} 
                    style={[
                      styles.tableCell,
                      { width: columnWidths[key] }
                    ]}
                  >
                    <Text
                      style={[styles.tableHeaderCell, { color: colors.primary }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {key}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {/* Rows */}
            {data.map((row, i) => (
              <View 
                key={i} 
                style={[
                  styles.tableRow,
                  i % 2 === 0 && { backgroundColor: colors.accent }
                ]}
              >
                <View style={[styles.tableCell, styles.actionCell]}>
                  <TouchableOpacity
                    style={[styles.copyButton, { backgroundColor: colors.muted }]}
                    onPress={() => handleCopyRow(row)}
                  >
                    <Copy size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                {Object.entries(row).map(([key, value], j) => (
                  <View 
                    key={j} 
                    style={[
                      styles.tableCell,
                      { width: columnWidths[key] }
                    ]}
                  >
                    <Text
                      style={[styles.tableCellText, { color: colors.foreground }]}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.floatingButton, { backgroundColor: colors.primary }]}
        onPress={() => setIsModalVisible(true)}
      >
        <Database size={24} color={colors.primaryForeground} />
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Database Inspector
            </Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={[styles.resetButton, { backgroundColor: colors.destructive }]}
                onPress={() => {
                  Alert.alert(
                    'Reset Database',
                    'Are you sure you want to reset the database? This will clear all data except authentication.',
                    [
                      {
                        text: 'Cancel',
                        style: 'cancel'
                      },
                      {
                        text: 'Reset',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await storage.resetLocalDBExceptAuth();
                            await fetchTableInfo(); // Refresh the table data
                            setSelectedTable(null);
                            setTableData({});
                            Alert.alert('Success', 'Database has been reset successfully');
                          } catch (error) {
                            console.error('Failed to reset database:', error);
                            Alert.alert('Error', 'Failed to reset database. Check console for details.');
                          }
                        }
                      }
                    ]
                  );
                }}
              >
                <Text style={[styles.resetButtonText, { color: colors.destructiveForeground }]}>
                  Reset DB
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.muted }]}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={[styles.closeButtonText, { color: colors.mutedForeground }]}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.contentContainer}>
            {tables.map((table) => (
              <View
                key={table.name}
                style={[styles.tableContainer, { borderColor: colors.border }]}
              >
                <TouchableOpacity
                  style={styles.tableHeader}
                  onPress={() => setSelectedTable(
                    selectedTable === table.name ? null : table.name
                  )}
                >
                  <View>
                    <Text style={[styles.tableName, { color: colors.foreground }]}>
                      {table.name}
                      {table.name === 'sqlite_sequence' && (
                        <Text style={[styles.systemTableIndicator, { color: colors.primary }]}>
                          {' '}(System Table - Tracks AUTOINCREMENT values)
                        </Text>
                      )}
                    </Text>
                    {table.name === 'sqlite_sequence' && (
                      <Text style={[styles.systemTableDescription, { color: colors.mutedForeground }]}>
                        Stores the highest used AUTOINCREMENT value for each table
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.rowCount, { color: colors.mutedForeground }]}>
                    {table.rowCount} rows
                  </Text>
                </TouchableOpacity>

                {selectedTable === table.name && (
                  <View style={styles.tableDetails}>
                    {renderTableSchema(table.sql, table.name)}
                    {renderTableData(table.name)}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          {/* Copy All Schemas Button */}
          <TouchableOpacity
            style={[
              styles.copyAllButton,
              { backgroundColor: colors.primary }
            ]}
            onPress={handleCopyAllSchemas}
          >
            {copiedStates['all'] ? (
              <CopyCheck size={20} color={colors.primaryForeground} />
            ) : (
              <Copy size={20} color={colors.primaryForeground} />
            )}
            <Text style={[styles.copyAllButtonText, { color: colors.primaryForeground }]}>
              {copiedStates['all'] ? 'Copied!' : 'Copy All Schemas'}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.large,
  },
  modalContainer: {
    flex: 1,
    marginTop: 50,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    ...theme.shadows.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.light.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
    borderRadius: theme.borderRadius.m,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    padding: theme.spacing.m,
  },
  tableContainer: {
    marginBottom: theme.spacing.m,
    borderWidth: 1,
    borderRadius: theme.borderRadius.m,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.m,
  },
  tableName: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowCount: {
    fontSize: 14,
  },
  tableDetails: {
    padding: theme.spacing.m,
    borderTopWidth: 1,
    borderTopColor: theme.colors.light.border,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: theme.spacing.s,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: theme.spacing.m,
  },
  tableDataContainer: {
    marginTop: theme.spacing.m,
  },
  tableWrapper: {
    borderRadius: theme.borderRadius.m,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.light.border,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.light.border,
    alignItems: 'center',
  },
  headerRow: {
    borderBottomWidth: 2,
  },
  tableCell: {
    paddingVertical: theme.spacing.s,
    paddingHorizontal: theme.spacing.m,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.colors.light.border,
  },
  actionCell: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableHeaderCell: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  tableCellText: {
    fontSize: 14,
    flexWrap: 'wrap',
  },
  copyButton: {
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.s,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
  },
  schemaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.s,
  },
  schemaActions: {
    flexDirection: 'row',
    gap: theme.spacing.s,
  },
  actionButton: {
    padding: theme.spacing.s,
    borderRadius: theme.borderRadius.s,
  },
  copyAllButton: {
    position: 'absolute',
    bottom: theme.spacing.m,
    right: theme.spacing.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.s,
    padding: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
    ...theme.shadows.medium,
  },
  copyAllButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  systemTableIndicator: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  systemTableDescription: {
    fontSize: 12,
    marginTop: 4,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: theme.spacing.s,
  },
  resetButton: {
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
    borderRadius: theme.borderRadius.m,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
}); 