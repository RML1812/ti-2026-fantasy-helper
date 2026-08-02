import { Component, computed, HostListener, input, output, signal } from '@angular/core';

export interface SelectOption {
    value: string;
    label: string;
}

@Component({
    selector: 'app-custom-select',
    standalone: true,
    imports: [],
    templateUrl: './custom-select.html',
    styleUrl: './custom-select.css',
})
export class CustomSelect {
    options = input.required<SelectOption[]>();
    value = input<string | null>(null);
    placeholder = input<string>('Select');
    valueChange = output<string | null>();

    isOpen = signal(false);

    selectedLabel = computed(() => {
        const val = this.value();
        if (val === null) return this.placeholder();
        const option = this.options().find(o => o.value === val);
        return option?.label ?? val;
    });

    toggle() {
        this.isOpen.update(v => !v);
    }

    select(value: string | null) {
        this.valueChange.emit(value);
        this.isOpen.set(false);
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest('.custom-select')) {
            this.isOpen.set(false);
        }
    }
}
