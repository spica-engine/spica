import React, {useCallback, useEffect, useRef, useState} from 'react'
import type {CellRendererProps} from '../types'
import {Popover, Button, FlexElement} from 'oziko-ui-kit'
import Editor from '@monaco-editor/react'
import type {editor} from 'monaco-editor'
import {useCellState} from '../useCellSelection'
import styles from './Cells.module.scss'

const JSON_EDITOR_LANGUAGE = 'json'
const DISPLAY_TEXT_MAX_LENGTH = 50
const POPOVER_WIDTH = 400
const POPOVER_HEIGHT = 400
const JSON_INDENT_SPACES = 2

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ')

const isPlainObject = (value: any): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

// A circular structure makes JSON.stringify throw; String(val) would then leak the
// literal "[object Object]", so fall back to a neutral placeholder for objects/arrays.
const safeStringFallback = (val: any): string =>
  typeof val === 'object' && val !== null ? (Array.isArray(val) ? '[…]' : '{…}') : String(val)

const valueToJsonString = (val: any): string => {
  if (val === null || val === undefined) {
    return ''
  }
  try {
    return JSON.stringify(val, null, JSON_INDENT_SPACES)
  } catch {
    return safeStringFallback(val)
  }
}

const compactPreview = (val: any): string => {
  if (val === null || val === undefined) {
    return ''
  }
  try {
    return JSON.stringify(val)
  } catch {
    return safeStringFallback(val)
  }
}

interface JsonParseResult {
  success: boolean
  value?: any
  error?: string
}

const parseJson = (jsonStr = ''): JsonParseResult => {
  if (!jsonStr.trim()) {
    return {success: true, value: null}
  }
  try {
    return {success: true, value: JSON.parse(jsonStr)}
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid JSON'
    }
  }
}

// Spica's bucket-data PATCH endpoint applies RFC 7386 JSON Merge Patch, so a key
// present in the stored object but absent from the edited object would survive
// unless explicitly nulled. Recurse so key removal works at any depth; non-object
// values (arrays, primitives, null) replace wholesale, which merge patch already
// does correctly.
const buildMergePatchValue = (oldVal: any, newVal: any): any => {
  if (!isPlainObject(oldVal) || !isPlainObject(newVal)) {
    return newVal
  }
  const patch: Record<string, any> = {}
  for (const key of Object.keys(newVal)) {
    patch[key] = key in oldVal ? buildMergePatchValue(oldVal[key], newVal[key]) : newVal[key]
  }
  for (const key of Object.keys(oldVal)) {
    if (!(key in newVal)) {
      patch[key] = null
    }
  }
  return patch
}

const getMonacoEditorOptions = (): editor.IStandaloneEditorConstructionOptions => ({
  minimap: {enabled: false},
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  formatOnPaste: true,
  formatOnType: true,
  lineNumbers: 'on',
  folding: true,
  automaticLayout: true
})

export const JsonCell: React.FC<CellRendererProps> = ({value, onChange, propertyKey, rowId}) => {
  const {isSelected, isEditing, select, requestEdit, exitEdit} = useCellState(rowId, propertyKey)
  const [editValue, setEditValue] = useState<string>(() => valueToJsonString(value))
  const [jsonError, setJsonError] = useState<string | null>(null)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  // Reseed the editor from the committed value each time edit mode opens so a
  // cancelled edit never leaks into the next session.
  useEffect(() => {
    if (isEditing) {
      setEditValue(valueToJsonString(value))
      setJsonError(null)
    }
  }, [isEditing, value])

  const handleEditorChange = useCallback((next: string | undefined = '') => {
    setEditValue(next)
    if (!next.trim()) {
      setJsonError(null)
      return
    }
    const result = parseJson(next)
    setJsonError(result.success ? null : result.error || 'Invalid JSON')
  }, [])

  const handleSave = useCallback(() => {
    const result = parseJson(editValue)
    if (!result.success) {
      setJsonError(result.error || 'Invalid JSON')
      return
    }
    onChange(buildMergePatchValue(value, result.value))
    setJsonError(null)
    exitEdit()
  }, [editValue, onChange, value, exitEdit])

  const handleCancel = useCallback(() => {
    setEditValue(valueToJsonString(value))
    setJsonError(null)
    exitEdit()
  }, [value, exitEdit])

  const monacoOptions = getMonacoEditorOptions()
  const preview = compactPreview(value)
  const displayText =
    preview.length > DISPLAY_TEXT_MAX_LENGTH
      ? `${preview.substring(0, DISPLAY_TEXT_MAX_LENGTH)}…`
      : preview

  return (
    <Popover
      open={isEditing}
      onClose={handleCancel}
      content={
        <div className={styles.complexEditorPopover} onClick={e => e.stopPropagation()}>
          <FlexElement dimensionX="fill" dimensionY="fill" gap={8} direction="vertical">
            <FlexElement
              dimensionX={POPOVER_WIDTH}
              dimensionY={POPOVER_HEIGHT}
              className={styles.monacoEditorWrapper}
              onKeyDown={e => e.stopPropagation()}
            >
              <Editor
                defaultLanguage={JSON_EDITOR_LANGUAGE}
                value={editValue}
                onChange={handleEditorChange}
                onMount={editorInstance => {
                  editorRef.current = editorInstance
                  editorInstance.updateOptions(monacoOptions)
                }}
                options={monacoOptions}
              />
            </FlexElement>

            {jsonError && <span className={styles.jsonEditorError}>{jsonError}</span>}

            <FlexElement dimensionX="fill" alignment="rightCenter" gap={8}>
              <Button variant="filled" onClick={handleCancel}>
                Cancel
              </Button>
              <Button variant="solid" onClick={handleSave} disabled={!!jsonError}>
                Save
              </Button>
            </FlexElement>
          </FlexElement>
        </div>
      }
      containerProps={{dimensionX: 'fill', dimensionY: 'fill', className: styles.cellShellContainer}}
      childrenProps={{dimensionX: 'fill', dimensionY: 'fill'}}
    >
      <span
        className={cx(styles.readDisplay, isSelected && styles.cellSelected)}
        title={valueToJsonString(value)}
        onClick={e => {
          e.stopPropagation()
          isSelected ? requestEdit() : select()
        }}
        onDoubleClick={e => {
          e.stopPropagation()
          requestEdit()
        }}
      >
        {displayText ? displayText : <span className={styles.emptyValue}>empty</span>}
      </span>
    </Popover>
  )
}
