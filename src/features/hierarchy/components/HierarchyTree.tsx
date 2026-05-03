// src/features/hierarchy/components/HierarchyTree.tsx

import React, { useState, useMemo } from "react";
import { Search, Users, ChevronDown, ChevronRight, User } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { AgentDetailModal } from "./AgentDetailModal";
import type { HierarchyNode } from "@/types/hierarchy.types";

interface HierarchyTreeProps {
  nodes: HierarchyNode[];
  onNodeClick?: (node: HierarchyNode) => void;
  className?: string;
}

interface TreeNodeProps {
  node: HierarchyNode;
  level: number;
  onNodeClick?: (node: HierarchyNode) => void;
  searchTerm: string;
  expandedNodes: Set<string>;
  toggleNode: (nodeId: string) => void;
}

/**
 * Optimized tree node component with lazy rendering and search
 */
function TreeNode({
  node,
  level,
  onNodeClick,
  searchTerm,
  expandedNodes,
  toggleNode,
}: TreeNodeProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const indentation = Math.min(level * 20, 100); // Cap indentation to prevent overflow</

  // Skip rendering if doesn't match search
  const matchesSearch =
    searchTerm === "" ||
    node.email.toLowerCase().includes(searchTerm.toLowerCase());

  // Check if any children match search
  const hasMatchingChildren = useMemo(() => {
    if (!searchTerm || !hasChildren) return false;
    const checkChildren = (n: HierarchyNode): boolean => {
      if (n.email.toLowerCase().includes(searchTerm.toLowerCase())) return true;
      if (n.children) {
        return n.children.some((child) => checkChildren(child));
      }
      return false;
    };
    return node.children?.some((child) => checkChildren(child)) || false;
  }, [node, searchTerm, hasChildren]);

  // Show if matches search or has matching children
  if (!matchesSearch && !hasMatchingChildren) return null;

  return (
    <div className="w-full">
      {/* Node Row - Optimized with highlight for search matches */}
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-all",
          matchesSearch && searchTerm
            ? "bg-warning/10/50"
            : "hover:bg-muted/50",
        )}
        style={{ paddingLeft: `${indentation + 8}px` }}
        onClick={() => onNodeClick?.(node)}
      >
        {/* Expand/Collapse Button */}
        <div className="flex-shrink-0 w-5">
          {hasChildren && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>

        {/* Agent Icon */}
        <div className="flex-shrink-0">
          <div className="h-6 w-6 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
            <User className="h-3 w-3" />
          </div>
        </div>

        {/* Agent Info - Compact */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <span className="text-sm font-medium truncate">{node.email}</span>
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            L{node.hierarchy_depth}
          </Badge>
          {hasChildren && (
            <span className="text-[10px] text-muted-foreground">
              {node.direct_downline_count} direct
            </span>
          )}
          {node.override_earnings !== undefined &&
            node.override_earnings > 0 && (
              <span className="text-[10px] font-medium text-success ml-auto">
                +{formatCurrency(node.override_earnings)}
              </span>
            )}
        </div>
      </div>

      {/* Children - Only render if expanded for performance */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onNodeClick={onNodeClick}
              searchTerm={searchTerm}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * HierarchyTree - Optimized tree with search, lazy loading, and performance enhancements
 * Designed to handle hundreds of agents efficiently
 */
export function HierarchyTree({
  nodes,
  onNodeClick,
  className,
}: HierarchyTreeProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<HierarchyNode | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    // Start with root nodes expanded
    return new Set(nodes?.map((n) => n.id) || []);
  });

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const handleNodeClick = (node: HierarchyNode) => {
    setSelectedAgent(node);
    setModalOpen(true);
    onNodeClick?.(node);
  };

  // Calculate total agent count
  const totalAgentCount = useMemo(() => {
    let count = 0;
    const countNodes = (nodeList: HierarchyNode[]) => {
      for (const node of nodeList) {
        count++;
        if (node.children) {
          countNodes(node.children);
        }
      }
    };
    if (nodes) countNodes(nodes);
    return count;
  }, [nodes]);

  // Auto-expand all when searching
  useMemo(() => {
    if (searchTerm) {
      const getAllNodeIds = (nodeList: HierarchyNode[]): string[] => {
        const ids: string[] = [];
        for (const node of nodeList) {
          ids.push(node.id);
          if (node.children) {
            ids.push(...getAllNodeIds(node.children));
          }
        }
        return ids;
      };
      if (nodes) {
        setExpandedNodes(new Set(getAllNodeIds(nodes)));
      }
    }
  }, [searchTerm, nodes]);

  if (!nodes || nodes.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Organization Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No hierarchy data available</p>
            <p className="text-sm mt-1">
              You are a root agent with no downlines
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Organization Chart
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {totalAgentCount} agents in your organization
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedNodes(new Set())}
                className="text-xs"
              >
                Collapse All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const getAllNodeIds = (
                    nodeList: HierarchyNode[],
                  ): string[] => {
                    const ids: string[] = [];
                    for (const node of nodeList) {
                      ids.push(node.id);
                      if (node.children) {
                        ids.push(...getAllNodeIds(node.children));
                      }
                    }
                    return ids;
                  };
                  setExpandedNodes(new Set(getAllNodeIds(nodes)));
                }}
                className="text-xs"
              >
                Expand All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agents by email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tree View */}
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <div className="min-w-[400px]">
              {nodes.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  level={0}
                  onNodeClick={handleNodeClick}
                  searchTerm={searchTerm}
                  expandedNodes={expandedNodes}
                  toggleNode={toggleNode}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Detail Modal */}
      <AgentDetailModal
        agent={selectedAgent}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
