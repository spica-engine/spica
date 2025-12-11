import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { CellKeyboardHandler, CellRendererProps, CellKeyboardContext } from '../types'
import { BaseCellRenderer } from './BaseCellRenderer'
import { Popover, Button, FlexElement } from 'oziko-ui-kit'
import Editor from '@monaco-editor/react'
import styles from './Cells.module.scss'

export const JsonCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  isFocused,
  onRequestBlur,
}) => {
  const [editValue, setEditValue] = useState<string>('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [pendingValue, setPendingValue] = useState<{ value: any; baseValue: any } | null>(null)
  const editorRef = useRef<any>(null)

  // Convert value to JSON string for editing
  const valueToJsonString = useCallback((val: any): string => {
    if (val === null || val === undefined) {
      return ''
    }
    try {
      return JSON.stringify(val, null, 2)
    } catch {
      return String(val)
    }
  }, [])

  // Parse JSON string to value
  const jsonStringToValue = useCallback((jsonStr: string = ''): { success: boolean; value?: any; error?: string } => {
    if (!jsonStr.trim()) {
      return { success: true, value: null }
    }
    try {
      const parsed = JSON.parse(jsonStr)
      return { success: true, value: parsed }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Invalid JSON' 
      }
    }
  }, [])

  // Initialize edit value from prop value
  useEffect(() => {
    if (!isFocused) {
      setEditValue(valueToJsonString(value))
      setJsonError(null)
    }
  }, [value, isFocused, valueToJsonString])

  // Track pending value changes
  useEffect(() => {
    if (!pendingValue) return

    if (JSON.stringify(value) !== JSON.stringify(pendingValue.baseValue)) {
      setPendingValue(null)
    }
  }, [value, pendingValue])

  // Validate JSON in real-time
  const handleEditorChange = useCallback((newValue: string | undefined = '') => {
    setEditValue(newValue)
    
    if (!newValue.trim()) {
      setJsonError(null)
      return
    }

    const result = jsonStringToValue(newValue)
    if (result.success) {
      setJsonError(null)
    } else {
      setJsonError(result.error || 'Invalid JSON')
    }
  }, [jsonStringToValue])

  // Save changes
  const handleSave = useCallback(() => {
    console.log('handleSave', editValue)
    const result = jsonStringToValue(editValue)
    console.log('result', result)
    if (result.success) {
      onChange(result.value)
      setPendingValue({ value: result.value, baseValue: result.value })
      setJsonError(null)
      onRequestBlur()
    }
  }, [editValue, jsonStringToValue, onChange, value, onRequestBlur])

  // Cancel changes
  const handleCancel = useCallback(() => {
    setEditValue(valueToJsonString(value))
    setJsonError(null)
    setPendingValue(null)
    onRequestBlur()
  }, [value, valueToJsonString, onRequestBlur])

  // Handle popover close
  const handlePopoverClose = useCallback(() => {
    // Save if valid, otherwise cancel
    const result = jsonStringToValue(editValue)
    if (result.success && editValue !== valueToJsonString(value)) {
      handleSave()
    } else {
      handleCancel()
    }
  }, [editValue, jsonStringToValue, value, valueToJsonString, handleSave, handleCancel])

  // Handle keyboard events
  useEffect(() => {
    if (!isFocused) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        handleCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isFocused, handleCancel])

  // Format value for display
  const displayValue = useCallback(() => {
    if (pendingValue?.value !== undefined) {
      return valueToJsonString(pendingValue.value)
    }
    return valueToJsonString(value)
  }, [value, pendingValue, valueToJsonString])

  const formattedJson = displayValue()
  const displayText = formattedJson.length > 50 
    ? formattedJson.substring(0, 50) + '...' 
    : formattedJson || '{}'

  return (
    <BaseCellRenderer isFocused={isFocused}>

        <Popover
          open={isFocused}
          onClose={handlePopoverClose}
          content={
            <FlexElement dimensionX="fill" dimensionY="fill"  gap={8} direction="vertical">
              <FlexElement dimensionX="fill" dimensionY="fill"  className={styles.monacoEditorWrapper} onKeyDown={(e) => e.stopPropagation()}>
                <Editor
                  defaultLanguage="json"
                  value={editValue}
                  onChange={handleEditorChange}
                  onMount={(editor) => {
                    editorRef.current = editor
                    editor.updateOptions({
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      formatOnPaste: true,
                      formatOnType: true,
                    })
                  }}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    formatOnPaste: true,
                    formatOnType: true,
                    lineNumbers: 'on',
                    folding: true,
                    automaticLayout: true,
                  }}
                />
              </FlexElement>


                <FlexElement dimensionX="fill"  alignment="rightCenter" gap={8}>
                  <Button
                    variant="filled"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="solid"
                    onClick={handleSave}
                    disabled={!!jsonError}
                  >
                    Save
                  </Button>
                </FlexElement>
            </FlexElement>
          }
          contentProps={{ className: styles.jsonPopoverContent, dimensionX: 400, dimensionY: 400 }}
  
        >
          <span className={styles.valueCell} title={formattedJson}>
            {displayText}
          </span>
        </Popover>

    </BaseCellRenderer>
  )
}

export const JsonCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: (event: KeyboardEvent, context: CellKeyboardContext): boolean => {
    // Allow typing keys to open the editor
    const isTypingKey = 
      event.key.length === 1 || 
      event.key === 'Backspace' || 
      event.key === 'Delete';
    
    if (isTypingKey) {
      return true
    }
    
    return false
  }
}

