import Utils from '../utils/Utils'
/**
 * Copyright (C) 2025 Dashmake Inc.
 *
 * This file is part of DDoc Office.
 *
 * DDoc Office is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DDoc Office is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
 */

export class NavigationTab {
  id: string // id (could be UUID, timestamp, etc.)
  title: string // title shown on the tab
  documentPath: string // Full path to the document
  documentExtension: string // e.g., Utils.PDF_EXTENSION
  documentContentType?: string // Native kind (text/sheet/slide/design/form/meeting)
  isActive: boolean // is this tab currently active
  isDirty: boolean // has the document been modified since last save
  isSecured: boolean // is the document encrypted or protected
  isReadOnly: boolean // is the document read-only
  isLoading: boolean // is the document currently loading
  lastAccessed: Date // timestamp of last access

  constructor(params: {
    id: string
    title: string
    documentPath: string
    documentExtension: string
    documentContentType?: string
    isActive?: boolean
    isDirty?: boolean
    isSecured?: boolean
    isReadOnly?: boolean
    isLoading?: boolean
    lastAccessed?: Date
  }) {
    this.id = params.id
    this.title = params.title
    this.documentPath = params.documentPath
    this.documentExtension = params.documentExtension
    this.documentContentType = params.documentContentType
    this.isActive = params.isActive ?? false
    this.isDirty = params.isDirty ?? false
    this.isSecured = params.isSecured ?? false
    this.isReadOnly = params.isReadOnly ?? false
    this.isLoading = params.isLoading ?? false
    this.lastAccessed = params.lastAccessed ?? new Date()
  }

  /**
   * Returns a JSON representation of the Tab.
   * This is useful for serialization or sending over a network.
   */
  toJSON(): object {
    return {
      id: this.id,
      title: this.title,
      documentPath: this.documentPath,
      documentExtension: this.documentExtension,
      documentContentType: this.documentContentType,
      isActive: this.isActive,
      isDirty: this.isDirty,
      isSecured: this.isSecured,
      isReadOnly: this.isReadOnly,
      isLoading: this.isLoading,
      lastAccessed: this.lastAccessed.toISOString()
    }
  }

  /**
   * Creates a NavigationTab instance from a JSON object.
   * This is useful for deserializing data received from a network or storage.
   */
  static fromJSON(json: any): NavigationTab {
    return new NavigationTab({
      id: json.id,
      title: json.title,
      documentPath: json.documentPath,
      documentExtension: json.documentExtension,
      documentContentType: json.documentContentType,
      isActive: json.isActive,
      isDirty: json.isDirty,
      isSecured: json.isSecured,
      isReadOnly: json.isReadOnly,
      isLoading: json.isLoading,
      lastAccessed: new Date(json.lastAccessed)
    })
  }
  /**
   * Returns the currently active tab from a list.
   * @param tabs Array of NavigationTab
   * @returns The instance of the active tab, or undefined if none is active
   */
  // static getActive(tabs: NavigationTab[]): NavigationTab | undefined | null {
  static getActiveId(tabs: NavigationTab[]): string | undefined {
    // return tabs.find(tab => tab.isActive)
    return tabs.find((tab) => tab.isActive)?.id
  }

  /**
   * Returns the currently active NavigationTab from a list.
   * @param tabs Array of NavigationTab
   * @returns The active NavigationTab instance, or undefined if none is active
   */
  static getActive(tabs: NavigationTab[]): NavigationTab | undefined {
    console.log('getActive tabs', tabs)
    return tabs.find((tab) => tab.isActive)
  }

  /**
   * Returns the index of the active tab in the list.
   * @param tabs Array of NavigationTab
   * @returns The index of the active tab, or -1 if none is active
   */
  static getActiveIndex(tabs: NavigationTab[]): number {
    return tabs.findIndex((tab) => tab.isActive)
  }
}
