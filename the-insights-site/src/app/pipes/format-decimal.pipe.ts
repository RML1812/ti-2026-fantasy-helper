import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'formatDecimal',
    standalone: true,
})
export class FormatDecimalPipe implements PipeTransform {
    transform(value: number | null | undefined, decimals = 2): string {
        if (value == null || isNaN(value)) {
            return '';
        }

        if (Number.isInteger(value)) {
            return value.toString();
        }

        return value.toFixed(decimals);
    }
}
