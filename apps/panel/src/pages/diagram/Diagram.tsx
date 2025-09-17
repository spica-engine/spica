import React, {useState, useRef, useEffect} from "react";
import {useBucketService} from "../../services/bucketService";
import type {Property, BucketType} from "../../services/bucketService";
import "./Diagram.css";
import ZoomControl from "../../components/molecules/zoom-control/ZoomControl";
import NodeView from "../../components/molecules/node-view/NodeView";

interface Field {
  id: string;
  name: string;
  type: string;
  isUnique?: boolean;
  isRelation?: boolean;
  relationTo?: string;
  path?: string; // Path to the field, needed for nested fields
  relationType?: "onetoone" | "onetomany"; // Store relation type
}

interface Node {
  id: string;
  name: string;
  position: {x: number; y: number};
  fields: Field[];
}

interface Relation {
  from: string;
  to: string;
  fromField: string;
  toField: string;
  type: "1:1" | "1:*" | "*:*";
  fromPath?: string; // Path to the field, for nested fields
}

const Diagram: React.FC = () => {
  const {apiGetBuckets, apiBuckets} = useBucketService();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({x: 0, y: 0});
  const [pan, setPan] = useState({x: 0, y: 0});
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({x: 0, y: 0});
  const [zoom, setZoom] = useState<number>(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fieldRefsMap = useRef<Map<string, DOMRect>>(new Map());

  // Convert bucket properties to fields, including nested properties
  const convertPropertyToField = (
    key: string, 
    property: Property, 
    path: string = key
  ): Field[] => {
    const fields: Field[] = [];
    
    const field: Field = {
      id: path,
      name: key,
      type: property.type,
      path: path
    };

    if (property.type === "relation") {
      field.isRelation = true;
      field.relationTo = property.bucketId;
      field.relationType = property.relationType;
    }

    if (key === "_id" || key === "id") {
      field.isUnique = true;
    }
    
    fields.push(field);

    // Handle nested properties in objects
    if (property.type === "object" && property.properties) {
      Object.entries(property.properties).forEach(([nestedKey, nestedProperty]) => {
        const nestedPath = `${path}.${nestedKey}`;
        const nestedFields = convertPropertyToField(nestedKey, nestedProperty, nestedPath);
        fields.push(...nestedFields);
      });
    }

    return fields;
  };

  // Convert buckets to nodes with relation-based positioning
  const convertBucketsToNodes = (buckets: BucketType[], extractedRelations: Relation[]): Node[] => {
    const nodeWidth = 350;
    const nodeHeight = 300;
    const baseSpacingX = nodeWidth + 350; // Column spacing
    const baseSpacingY = nodeHeight + 250;

    // Analyze relationships to determine positioning
    const bucketRelations = new Map<string, { incoming: Set<string>, outgoing: Set<string> }>();
    
    // Initialize all buckets
    buckets.forEach(bucket => {
      bucketRelations.set(bucket._id, { incoming: new Set(), outgoing: new Set() });
    });

    // Process relations to build dependency graph
    extractedRelations.forEach(relation => {
      const fromBucket = bucketRelations.get(relation.from);
      const toBucket = bucketRelations.get(relation.to);
      
      if (fromBucket) {
        fromBucket.outgoing.add(relation.to);
      }
      if (toBucket) {
        toBucket.incoming.add(relation.from);
      }
    });

    // Determine column positions based on relationships
    const columnAssignments = new Map<string, number>();
    const processedBuckets = new Set<string>();
    
    // Helper function to assign columns recursively
    const assignColumn = (bucketId: string, column: number = 0): void => {
      if (processedBuckets.has(bucketId)) return;
      
      processedBuckets.add(bucketId);
      const currentAssignment = columnAssignments.get(bucketId);
      
      // Only update if this is a higher column number (further right)
      if (currentAssignment === undefined || column > currentAssignment) {
        columnAssignments.set(bucketId, column);
      }
      
      // Process outgoing relations (children should be in next column)
      const relations = bucketRelations.get(bucketId);
      if (relations) {
        relations.outgoing.forEach(targetId => {
          assignColumn(targetId, (columnAssignments.get(bucketId) || 0) + 1);
        });
      }
    };

    // Start with buckets that have no incoming relations (root nodes)
    buckets.forEach(bucket => {
      const relations = bucketRelations.get(bucket._id);
      if (relations && relations.incoming.size === 0) {
        assignColumn(bucket._id, 0); // Start from column 0
      }
    });

    // Handle isolated nodes (no relations at all)
    const maxColumn = Math.max(...Array.from(columnAssignments.values()), -1);
    const isolatedColumn = maxColumn + 2; // Place isolated nodes 2 columns after the last connected node
    
    buckets.forEach(bucket => {
      const relations = bucketRelations.get(bucket._id);
      if (relations && relations.incoming.size === 0 && relations.outgoing.size === 0) {
        columnAssignments.set(bucket._id, isolatedColumn);
      }
    });

    // Create position map for each column
    const columnNodeCounts = new Map<number, number>();
    
    return buckets.map((bucket) => {
      const fields: Field[] = [];

      fields.push({
        id: "_id",
        name: "_id",
        type: "unique",
        isUnique: true,
        path: "_id"
      });

      Object.entries(bucket.properties || {}).forEach(([key, property]) => {
        const propertyFields = convertPropertyToField(key, property);
        fields.push(...propertyFields);
      });

      // Determine column and position within column
      const column = columnAssignments.get(bucket._id) || 0;
      const nodeIndexInColumn = columnNodeCounts.get(column) || 0;
      columnNodeCounts.set(column, nodeIndexInColumn + 1);

      // Calculate position
      const x = 100 + column * baseSpacingX;
      const y = 100 + nodeIndexInColumn * baseSpacingY;

      return {
        id: bucket._id,
        name: bucket.title,
        position: {x, y},
        fields
      };
    });
  };

  // Extract relations from bucket data, including nested relations
  const extractRelations = (buckets: BucketType[]): Relation[] => {
    const relations: Relation[] = [];

    const processProperty = (
      bucketId: string,
      key: string,
      property: any,
      path: string = key
    ) => {
      if (property.type === "relation") {
        // Map the relation type string to a display format
        let relationType: "1:1" | "1:*" | "*:*";
        
        switch (property.relationType) {
          case "onetoone":
            relationType = "1:1";
            break;
          case "onetomany":
            relationType = "1:*";
            break;
          case "manytomany":
            relationType = "*:*";
            break;
          default:
            relationType = "1:*"; // Default case
        }

        relations.push({
          from: bucketId,
          to: property.bucketId,
          fromField: key,
          toField: "_id",
          type: relationType,
          fromPath: path
        });
      } else if (property.type === "object" && property.properties) {
        // Process nested properties
        Object.entries(property.properties).forEach(([nestedKey, nestedProperty]) => {
          const nestedPath = `${path}.${nestedKey}`;
          processProperty(bucketId, nestedKey, nestedProperty, nestedPath);
        });
      }
    };

    buckets.forEach(bucket => {
      Object.entries(bucket.properties || {}).forEach(([key, property]) => {
        processProperty(bucket._id, key, property);
      });
    });

    return relations;
  };

  // Effect to update field positions whenever nodes render
  useEffect(() => {
    const updateFieldPositions = () => {
      // Clear previous refs
      fieldRefsMap.current.clear();
      
      // Find all field elements and store their positions
      document.querySelectorAll(`.field-row`).forEach(el => {
        const fieldId = el.getAttribute('data-field-path');
        const nodeId = el.getAttribute('data-node-id');
        
        if (fieldId && nodeId) {
          const key = `${nodeId}-${fieldId}`;
          fieldRefsMap.current.set(key, el.getBoundingClientRect());
        }
      });
    };
    
    // Use a small timeout to ensure elements are rendered
    const timer = setTimeout(updateFieldPositions, 100);
    
    return () => clearTimeout(timer);
  }, [nodes]);

  useEffect(() => {
    apiGetBuckets();
  }, [apiGetBuckets]);

  useEffect(() => {
    console.log("API Buckets:", apiBuckets);
    if (apiBuckets && apiBuckets.length > 0) {
      const extractedRelations = extractRelations(apiBuckets);
      setRelations(extractedRelations);

      const convertedNodes = convertBucketsToNodes(apiBuckets, extractedRelations);
      console.log("Converted Nodes:", convertedNodes);
      setNodes(convertedNodes);
    }
  }, [apiBuckets]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(prev * 1.05, 3));
    } else {
      setZoom(prev => Math.max(prev / 1.05, 0.3));
    }
  };

  // Pan handlers
  const handlePanStart = (e: React.MouseEvent) => {
    if (
      e.target === containerRef.current ||
      (e.target as HTMLElement).closest(".diagram-content")
    ) {
      setIsPanning(true);
      setLastPanPoint({x: e.clientX, y: e.clientY});
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
      setLastPanPoint({x: e.clientX, y: e.clientY});
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

      setNodes(prev =>
        prev.map(node => (node.id === dragging ? {...node, position: {x: newX, y: newY}} : node))
      );
    } else {
      handlePanMove(e);
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    handlePanEnd();
  };

  const addField = (nodeId: string) => {
    const newFieldName = prompt("Enter field name:");
    const fieldType = prompt(
      "Enter field type (text, number, boolean, object, array, relation, unique):"
    );

    if (!newFieldName || !fieldType) return;

    setNodes(prev =>
      prev.map(node =>
        node.id === nodeId
          ? {
              ...node,
              fields: [
                ...node.fields,
                {
                  id: `${nodeId}_${newFieldName}`,
                  name: newFieldName,
                  type: fieldType,
                  path: newFieldName
                }
              ]
            }
          : node
      )
    );
  };

  const removeField = (nodeId: string, fieldId: string) => {
    setNodes(prev =>
      prev.map(node =>
        node.id === nodeId ? {...node, fields: node.fields.filter(f => f.id !== fieldId)} : node
      )
    );
  };

  const renderRelationArrow = (relation: Relation) => {
    const fromNode = nodes.find(n => n.id === relation.from);
    const toNode = nodes.find(n => n.id === relation.to);

    if (!fromNode || !toNode) return null;

    const nodeWidth = 350;
    const fieldHeight = 30;
    const headerHeight = 50;
    const spacing = 5;
    
    // Find the field in the source node
    const fromFieldPath = relation.fromPath || relation.fromField;
    const fromField = fromNode.fields.find(f => f.path === fromFieldPath);
    
    if (!fromField) return null;
    
    // Calculate field index to determine y position
    const fromFieldIndex = fromNode.fields.findIndex(f => f.path === fromFieldPath);
    
    // Calculate starting point (from field position)
    const startX = fromNode.position.x + nodeWidth - spacing;
    const startY = fromNode.position.y + headerHeight + (fromFieldIndex * fieldHeight) + (fieldHeight / 2);
    
    // Calculate ending point (to node)
    const endX = toNode.position.x + spacing;
    const endY = toNode.position.y + headerHeight;
    
    // Parse relation type for display
    const [startType, endType] = relation.type.split(":");
    
    // Generate a unique ID for this relation
    const relationId = `${relation.from}-${fromFieldPath}-${relation.to}`;

    // Calculate midpoint for relation type label
    const midX = startX + (endX - startX) / 2;
    const midY = startY + (endY - startY) / 2;

    return (
      <g key={relationId} className="relation-line">
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke="#666"
          strokeWidth="2"
          markerEnd="url(#arrowhead)"
        />
        
        {/* Relation type label */}
        <text
          x={midX}
          y={midY - 10}
          textAnchor="middle"
          fontSize="12"
          fill="#444"
          fontWeight="bold"
          className="relation-type-label"
          style={{ backgroundColor: "white", padding: "2px" }}
        >
          {relation.type}
        </text>
        
        {/* Start type marker */}
        <text
          x={startX - 15}
          y={startY - 5}
          textAnchor="end"
          fontSize="12"
          fill="#666"
          fontWeight="bold"
        >
          {startType}
        </text>
        
        {/* End type marker */}
        <text
          x={endX + 15}
          y={endY - 5}
          textAnchor="start"
          fontSize="12"
          fill="#666"
          fontWeight="bold"
        >
          {endType}
        </text>
      </g>
    );
  };

  if (!apiBuckets || apiBuckets.length === 0) {
    return (
      <div className="diagram-container">
        <div className="loading-message">Loading buckets...</div>
      </div>
    );
  }

  return (
    <div className="diagram-wrapper">
      <ZoomControl
        zoom={zoom}
        setZoom={setZoom}
        setPan={setPan}
        containerRef={containerRef}
        nodes={nodes}
      />

      <div
        ref={containerRef}
        className="diagram-container"
        onMouseDown={handlePanStart}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{
          cursor: isPanning ? "grabbing" : dragging ? "grabbing" : "grab"
        }}
      >
        <div
          className="diagram-content"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0"
          }}
        >
          <svg
            ref={svgRef}
            className="relations-svg"
            style={{
              width: "5000px",
              height: "5000px",
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none"
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
            <NodeView
              key={node.id}
              node={node}
              onMouseDown={handleMouseDown}
              onAddField={addField}
              onRemoveField={removeField}
              dragging={dragging === node.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Diagram;
