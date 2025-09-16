import React, { useState, useRef, useEffect } from 'react';
import { useBucketService } from '../../services/bucketService';
import type { Property, BucketType } from '../../services/bucketService';
import './Diagram.css';

interface Field {
  id: string;
  name: string;
  type: string;
  isUnique?: boolean;
  isRelation?: boolean;
  relationTo?: string;
}

interface Node {
  id: string;
  name: string;
  position: { x: number; y: number };
  fields: Field[];
}

interface Relation {
  from: string;
  to: string;
  fromField: string;
  toField: string;
  type: '1:1' | '1:*' | '*:*';
}

const Diagram: React.FC = () => {
  const { apiGetBuckets, apiBuckets } = useBucketService();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1); // Add zoom state
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert bucket properties to fields
  const convertPropertyToField = (key: string, property: Property): Field => {
    const field: Field = {
      id: key,
      name: key,
      type: property.type
    };

    if (property.type === 'relation') {
      field.isRelation = true;
      field.relationTo = property.bucketId;
    }

    if (key === '_id' || key === 'id') {
      field.isUnique = true;
    }

    return field;
  };

  // Convert buckets to nodes with structured random positioning
  const convertBucketsToNodes = (buckets: BucketType[]): Node[] => {
    const nodeWidth = 350;
    const nodeHeight = 300;
    const gridCols = Math.ceil(Math.sqrt(buckets.length));
    const baseSpacingX = nodeWidth + 150;
    const baseSpacingY = nodeHeight + 100;
    
    return buckets.map((bucket, index) => {
      const fields: Field[] = [];
      
      fields.push({
        id: '_id',
        name: '_id',
        type: 'unique',
        isUnique: true
      });

      Object.entries(bucket.properties || {}).forEach(([key, property]) => {
        fields.push(convertPropertyToField(key, property));
      });

      const gridX = index % gridCols;
      const gridY = Math.floor(index / gridCols);
      
      const randomOffsetX = (Math.random() - 0.5) * 100;
      const randomOffsetY = (Math.random() - 0.5) * 80;
      
      const x = 100 + (gridX * baseSpacingX) + randomOffsetX;
      const y = 100 + (gridY * baseSpacingY) + randomOffsetY;

      return {
        id: bucket._id,
        name: bucket.title,
        position: { x, y },
        fields
      };
    });
  };

  // Extract relations from bucket data
  const extractRelations = (buckets: BucketType[]): Relation[] => {
    const relations: Relation[] = [];

    buckets.forEach(bucket => {
      Object.entries(bucket.properties || {}).forEach(([fieldKey, property]) => {
        if (property.type === 'relation') {
          const relationType = property.relationType === 'onetoone' ? '1:1' : '1:*';
          
          relations.push({
            from: bucket._id,
            to: property.bucketId,
            fromField: fieldKey,
            toField: '_id',
            type: relationType
          });
        }
      });
    });

    return relations;
  };

  useEffect(() => {
    apiGetBuckets();
  }, [apiGetBuckets]);

  useEffect(() => {
    if (apiBuckets && apiBuckets.length > 0) {
      const convertedNodes = convertBucketsToNodes(apiBuckets);
      const extractedRelations = extractRelations(apiBuckets);
      
      setNodes(convertedNodes);
      setRelations(extractedRelations);
    }
  }, [apiBuckets]);

  // Zoom handlers
  const zoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 3)); // Limit max zoom to 3x
  };

  const zoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.3)); // Limit min zoom to 0.3x
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(prev * 1.05, 3));
    } else {
      setZoom(prev => Math.max(prev / 1.05, 0.3));
    }
  };

  // Fit to view function
  const fitToView = () => {
    if (nodes.length === 0 || !containerRef.current) return;
    
    // Calculate bounding box of all nodes
    const nodeWidth = 350;
    const nodeHeight = 300;
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + nodeWidth);
      maxY = Math.max(maxY, node.position.y + nodeHeight);
    });
    
    // Add padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Get container dimensions
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // Calculate zoom to fit
    const zoomX = containerWidth / width;
    const zoomY = containerHeight / height;
    const newZoom = Math.min(zoomX, zoomY, 1); // Cap at 1 to prevent zooming in too much
    
    // Set the new zoom and center the view
    setZoom(newZoom);
    setPan({
      x: containerWidth / 2 - ((minX + maxX) / 2) * newZoom,
      y: containerHeight / 2 - ((minY + maxY) / 2) * newZoom
    });
  };

  // Pan handlers
  const handlePanStart = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).closest('.diagram-content')) {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handlePanMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      setPan(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setDragging(nodeId);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const nodeScreenX = node.position.x * zoom + pan.x;
    const nodeScreenY = node.position.y * zoom + pan.y;

    setDragOffset({
      x: mouseX - nodeScreenX,
      y: mouseY - nodeScreenY
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const newX = (mouseX - pan.x - dragOffset.x) / zoom;
      const newY = (mouseY - pan.y - dragOffset.y) / zoom;

      setNodes(prev => prev.map(node => 
        node.id === dragging 
          ? { ...node, position: { x: newX, y: newY } }
          : node
      ));
    } else {
      handlePanMove(e);
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    handlePanEnd();
  };

  const addField = (nodeId: string) => {
    const newFieldName = prompt('Enter field name:');
    const fieldType = prompt('Enter field type (text, number, boolean, object, array, relation, unique):');
    
    if (!newFieldName || !fieldType) return;

    setNodes(prev => prev.map(node => 
      node.id === nodeId 
        ? { ...node, fields: [...node.fields, { 
            id: `${nodeId}_${newFieldName}`, 
            name: newFieldName, 
            type: fieldType 
          }] }
        : node
    ));
  };

  const removeField = (nodeId: string, fieldId: string) => {
    setNodes(prev => prev.map(node => 
      node.id === nodeId 
        ? { ...node, fields: node.fields.filter(f => f.id !== fieldId) }
        : node
    ));
  };

  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'unique': return '🔑';
      case 'string': return '📝';
      case 'textarea': return '📝';
      case 'number': return '🔢';
      case 'boolean': return '☑️';
      case 'object': return '📦';
      case 'array': return '📋';
      case 'multiselect': return '📋';
      case 'relation': return '🔗';
      case 'date': return '📅';
      case 'color': return '🎨';
      case 'storage': return '💾';
      case 'location': return '📍';
      case 'richtext': return '📄';
      default: return '•';
    }
  };

  const getFieldTypeDisplay = (field: Field) => {
    if (field.isUnique) return 'unique';
    if (field.isRelation) return 'relation';
    return field.type;
  };

  const renderRelationArrow = (relation: Relation) => {
    const fromNode = nodes.find(n => n.id === relation.from);
    const toNode = nodes.find(n => n.id === relation.to);
    
    if (!fromNode || !toNode) return null;

    const nodeWidth = 350;
    const spacing = 20;
    
    const startX = fromNode.position.x + nodeWidth + spacing;
    const startY = fromNode.position.y + 100;
    const endX = toNode.position.x - spacing;
    const endY = toNode.position.y + 100;

    const [startType, endType] = relation.type.split(':');

    return (
      <g key={`${relation.from}-${relation.to}`}>
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke="#666"
          strokeWidth="2"
          markerEnd="url(#arrowhead)"
        />
        <text
          x={startX + 10}
          y={startY - 10}
          textAnchor="middle"
          fontSize="14"
          fill="#666"
          fontWeight="bold"
        >
          {startType}
        </text>
        <text
          x={endX - 10}
          y={endY - 10}
          textAnchor="middle"
          fontSize="14"
          fill="#666"
          fontWeight="bold"
        >
          {endType}
        </text>
      </g>
    );
  };

  const reorganizeNodes = () => {
    const nodeWidth = 350;
    const nodeHeight = 300;
    const gridCols = Math.ceil(Math.sqrt(nodes.length));
    const baseSpacingX = nodeWidth + 200;
    const baseSpacingY = nodeHeight + 150;

    setNodes(prev => prev.map((node, index) => {
      const gridX = index % gridCols;
      const gridY = Math.floor(index / gridCols);
      
      const patternOffset = {
        x: gridY % 2 === 0 ? 0 : 50,
        y: gridX % 3 === 0 ? -30 : gridX % 3 === 1 ? 0 : 30
      };
      
      const randomOffset = {
        x: (Math.random() - 0.5) * 80,
        y: (Math.random() - 0.5) * 60
      };

      return {
        ...node,
        position: {
          x: 100 + (gridX * baseSpacingX) + patternOffset.x + randomOffset.x,
          y: 100 + (gridY * baseSpacingY) + patternOffset.y + randomOffset.y
        }
      };
    }));
  };

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  if (!apiBuckets || apiBuckets.length === 0) {
    return (
      <div className="diagram-container">
        <div className="loading-message">
          Loading buckets...
        </div>
      </div>
    );
  }

  return (
    <div className="diagram-wrapper">
      <div className="controls">
        <button onClick={resetView} className="control-btn">Reset View</button>
        <button onClick={reorganizeNodes} className="control-btn">Reorganize</button>
        <button onClick={zoomIn} className="control-btn">Zoom In</button>
        <button onClick={zoomOut} className="control-btn">Zoom Out</button>
        <button onClick={fitToView} className="control-btn">Fit to View</button>
        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
      </div>

      <div 
        ref={containerRef}
        className="diagram-container"
        onMouseDown={handlePanStart}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{
          cursor: isPanning ? 'grabbing' : dragging ? 'grabbing' : 'grab'
        }}
      >
        <div
          className="diagram-content"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0'
          }}
        >
          <svg 
            ref={svgRef}
            className="relations-svg"
            style={{
              width: '5000px',
              height: '5000px'
            }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="0"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
              </marker>
            </defs>
            {relations.map(renderRelationArrow)}
          </svg>

          {nodes.map(node => (
            <div
              key={node.id}
              className="node"
              style={{
                left: node.position.x,
                top: node.position.y,
                cursor: dragging === node.id ? 'grabbing' : 'grab'
              }}
              onMouseDown={(e) => handleMouseDown(node.id, e)}
            >
              <div className="node-header">
                <h3>{node.name}</h3>
                <span className="node-id">{node.id.substring(0, 12)}...</span>
                <div className="node-controls">
                  <button className="control-btn">⚙️</button>
                  <button className="control-btn delete">🗑️</button>
                </div>
              </div>

              <div className="node-fields">
                {node.fields.map(field => (
                  <div key={field.id} className="field-row">
                    <span className="field-icon">{getFieldIcon(field.type)}</span>
                    <span className="field-name">{field.name}</span>
                    <span className="field-type">{getFieldTypeDisplay(field)}</span>
                    <div className="field-controls">
                      <button className="control-btn">✏️</button>
                      <button 
                        className="control-btn delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeField(node.id, field.id);
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
                
                <button 
                  className="add-field-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    addField(node.id);
                  }}
                >
                  + Add New Field
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Diagram;