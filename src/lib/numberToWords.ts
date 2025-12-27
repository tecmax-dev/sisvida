// Convert number to words in Portuguese (Brazilian)
const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function convertHundreds(num: number): string {
  if (num === 0) return '';
  if (num === 100) return 'cem';
  
  let result = '';
  
  const h = Math.floor(num / 100);
  const remainder = num % 100;
  
  if (h > 0) {
    result += hundreds[h];
    if (remainder > 0) result += ' e ';
  }
  
  if (remainder >= 10 && remainder < 20) {
    result += teens[remainder - 10];
  } else {
    const t = Math.floor(remainder / 10);
    const u = remainder % 10;
    
    if (t > 0) {
      result += tens[t];
      if (u > 0) result += ' e ';
    }
    if (u > 0) {
      result += units[u];
    }
  }
  
  return result;
}

function convertThousands(num: number): string {
  if (num === 0) return '';
  
  const thousands = Math.floor(num / 1000);
  const remainder = num % 1000;
  
  let result = '';
  
  if (thousands > 0) {
    if (thousands === 1) {
      result = 'mil';
    } else {
      result = convertHundreds(thousands) + ' mil';
    }
    
    if (remainder > 0) {
      // Use "e" if remainder < 100 or ends in 00
      if (remainder < 100 || remainder % 100 === 0) {
        result += ' e ';
      } else {
        result += ' ';
      }
    }
  }
  
  if (remainder > 0) {
    result += convertHundreds(remainder);
  }
  
  return result;
}

function convertMillions(num: number): string {
  if (num === 0) return '';
  
  const millions = Math.floor(num / 1000000);
  const remainder = num % 1000000;
  
  let result = '';
  
  if (millions > 0) {
    if (millions === 1) {
      result = 'um milhão';
    } else {
      result = convertHundreds(millions) + ' milhões';
    }
    
    if (remainder > 0) {
      if (remainder < 1000 && remainder > 0) {
        result += ' e ';
      } else {
        result += ' ';
      }
    }
  }
  
  if (remainder > 0) {
    result += convertThousands(remainder);
  }
  
  return result;
}

export function numberToWords(value: number): string {
  if (value === 0) return 'zero reais';
  
  const integerPart = Math.floor(Math.abs(value));
  const decimalPart = Math.round((Math.abs(value) - integerPart) * 100);
  
  let result = '';
  
  // Integer part (reais)
  if (integerPart > 0) {
    if (integerPart === 1) {
      result = 'um real';
    } else {
      result = convertMillions(integerPart) + ' reais';
    }
  }
  
  // Decimal part (centavos)
  if (decimalPart > 0) {
    if (integerPart > 0) {
      result += ' e ';
    }
    
    if (decimalPart === 1) {
      result += 'um centavo';
    } else {
      result += convertHundreds(decimalPart) + ' centavos';
    }
  }
  
  return result.trim();
}

export function capitalizeFirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
