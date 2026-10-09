import React from 'react';
import { Dialog, Badge, Icon } from '../../design-system';
import { getAllWorkflows } from '../../../services/workflows/registry';
import { t } from '@i18n/index';

export interface ServiceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentServiceId: string;
  onSelectService: (serviceId: string) => void;
}

export const ServiceSelectorModal: React.FC<ServiceSelectorModalProps> = ({
  isOpen,
  onClose,
  currentServiceId,
  onSelectService,
}) => {
  const workflows = getAllWorkflows();

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('services.selectService') || 'Select TTD Service'}
      description={t('services.selectServiceDesc') || 'Choose the booking service to prepare your devotee details.'}
    >
      <div className="space-y-2">
        {workflows.map((wf) => {
          const isSelected = wf.serviceId === currentServiceId;
          return (
            <button
              key={wf.serviceId}
              type="button"
              onClick={() => {
                onSelectService(wf.serviceId);
                onClose();
              }}
              className={`
                w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between
                ${
                  isSelected
                    ? 'border-[#54258A] dark:border-[#D4A72C] bg-[#54258A]/5 dark:bg-[#D4A72C]/10'
                    : 'border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20 bg-white dark:bg-[#2C1A35]'
                }
              `}
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-xs font-bold text-[#321B3F] dark:text-[#F8EFD8] truncate">
                    {wf.serviceName}
                  </p>
                  {wf.ticketPrice && (
                    <Badge variant="gold" size="sm">
                      ₹{wf.ticketPrice}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-[#6B5A70] dark:text-[#A692B4] truncate">
                  {wf.maxPilgrims ? `Up to ${wf.maxPilgrims} devotees` : 'Devotee service'}
                </p>
              </div>

              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-[#54258A] dark:bg-[#D4A72C] flex items-center justify-center text-white dark:text-[#211526] shrink-0">
                  <Icon name="check" size={12} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </Dialog>
  );
};
