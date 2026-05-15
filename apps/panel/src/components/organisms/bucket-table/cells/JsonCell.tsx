import React, { useCallback, useRef, useState } from 'react'
import type { CellRendererProps } from '../types'
import { Popover, Button, FlexElement } from 'oziko-ui-kit'
import Editor from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import styles from './Cells.module.scss'

const JSON_EDITOR_LANGUAGE = 'json'
const DEFAULT_EMPTY_JSON = '{}'
const DISPLAY_TEXT_MAX_LENGTH = 50
const POPOVER_WIDTH = 400
const POPOVER_HEIGHT = 400
const JSON_INDENT_SPACES = 2

interface JsonParseResult {
  success: boolean
  value?: any
  error?: string
}

interface PendingValue {
  value: any
  baseValue: any
}

const valueToJsonString = (val: any): string => {
  if (val === null || val === undefined) {
    return ''
  }
  try {
    return JSON.stringify(val, null, JSON_INDENT_SPACES)
  } catch {
    return String(val)
  }
}

const jsonStringToValue = (jsonStr: string = ''): JsonParseResult => {
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
}

const isPlainObject = (value: any): boolean => {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

const mergeRemovedKeys = (oldValue: Record<string, any>, newValue: Record<string, any>): Record<string, any> => {
  const oldKeys = Object.keys(oldValue)
  const newKeys = Object.keys(newValue)
  const removedKeys = oldKeys.filter(key => !newKeys.includes(key))

  if (removedKeys.length === 0) {
    return newValue
  }

  const mergedValue = { ...newValue }
  removedKeys.forEach(key => {
    mergedValue[key] = null
  })
  return mergedValue
}

const getMonacoEditorOptions = (): editor.IStandaloneEditorConstructionOptions => ({
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  formatOnPaste: true,
  formatOnType: true,
  lineNumbers: 'on',
  folding: true,
  automaticLayout: true,
})

export const JsonCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [editValue, setEditValue] = useState<string>(() => valueToJsonString(value))
  const [jsonError, setJsonError] = useState<string | null>(null)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const handleEditorChange = useCallback((newValue: string | undefined = '') => {
    setEditValue(newValue)

    if (!newValue.trim()) {
      setJsonError(null)
      return
    }

    const result = jsonStringToValue(newValue)
    setJsonError(result.success ? null : (result.error || 'Invalid JSON'))
  }, [])

  const handleSave = useCallback(() => {
    const result = jsonStringToValue(editValue)
    if (!result.success) {
      return
    }

    let valueToSend = result.value

    if (isPlainObject(value) && isPlainObject(result.value)) {
      valueToSend = mergeRemovedKeys(value, result.value)
    }

    onChange(valueToSend)
    setJsonError(null)
    setIsOpen(false)
  }, [editValue, onChange, value])

  const handleCancel = useCallback(() => {
    setEditValue(valueToJsonString(value))
    setJsonError(null)
    setIsOpen(false)
  }, [value])

  const handleOpen = useCallback(() => {
    setEditValue(valueToJsonString(value))
    setIsOpen(true)
  }, [value])

  const formattedJson = valueToJsonString(value)
  const displayText = formattedJson.length > DISPLAY_TEXT_MAX_LENGTH
    ? `${formattedJson.substring(0, DISPLAY_TEXT_MAX_LENGTH)}...`
    : formattedJson || DEFAULT_EMPTY_JSON

  const monacoOptions = getMonacoEditorOptions()

  return (
    <Popover
      open={isOpen}
      onClose={handleCancel}
      content={
        <FlexElement dimensionX="fill" dimensionY="fill" gap={8} direction="vertical">
          <FlexElement
            dimensionX="fill"
            dimensionY="fill"
            className={styles.monacoEditorWrapper}
            onKeyDown={(e) => e.stopPropagation()}
            >
              <Editor
                defaultLanguage={JSON_EDITOR_LANGUAGE}
                value={editValue}
                onChange={handleEditorChange}
                onMount={(editor) => {
                  editorRef.current = editor
                  editor.updateOptions(monacoOptions)
                }}
                options={monacoOptions}
              />
            </FlexElement>

            <FlexElement dimensionX="fill" alignment="rightCenter" gap={8}>
              <Button variant="filled" onClick={handleCancel}>
                Cancel
              </Button>
              <Button variant="solid" onClick={handleSave} disabled={!!jsonError}>
                Save
              </Button>
            </FlexElement>
          </FlexElement>
        }
        contentProps={{
          className: styles.jsonPopoverContent,
          dimensionX: POPOVER_WIDTH,
          dimensionY: POPOVER_HEIGHT,
        }}
      >
        <span className={styles.valueCell} title={formattedJson} onClick={handleOpen}>
          {displayText}
        </span>
      </Popover>
  )
}

