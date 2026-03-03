import React from "react";
import type { RecentBranch } from "../../../shared/webview/contracts";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  ListStateMessage
} from "../../../shared/webview/components";

interface BranchListSectionProps {
  primaryBranches: RecentBranch[];
  otherBranches: RecentBranch[];
  isLoading: boolean;
  otherBranchesAccordionValue: string | undefined;
  onOtherBranchesAccordionValueChange(nextValue: string | undefined): void;
  renderBranchRow(branch: RecentBranch): React.ReactNode;
}

function BranchListSection({
  primaryBranches,
  otherBranches,
  isLoading,
  otherBranchesAccordionValue,
  onOtherBranchesAccordionValueChange,
  renderBranchRow
}: BranchListSectionProps) {
  return (
    <div className="flex min-h-14 flex-col gap-1.5">
      {primaryBranches.length === 0 ? (
        <ListStateMessage>
          {isLoading ? "Loading recent branches..." : "No recent branches yet."}
        </ListStateMessage>
      ) : (
        primaryBranches.map((branch) => renderBranchRow(branch))
      )}
      {otherBranches.length > 0 ? (
        <Accordion
          collapsible
          type="single"
          value={otherBranchesAccordionValue}
          onValueChange={(nextValue) => {
            onOtherBranchesAccordionValueChange(nextValue);
          }}
        >
          <AccordionItem value="other-branches">
            <AccordionTrigger className="px-2.5 py-1.5 text-xs font-medium">
              Other branches ({otherBranches.length})
            </AccordionTrigger>
            <AccordionContent className="px-2 py-1.5">
              <div className="max-h-72 overflow-y-auto pr-1">
                <div className="flex min-h-10 flex-col gap-1.5">
                  {otherBranches.map((branch) => renderBranchRow(branch))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </div>
  );
}

export { BranchListSection };
