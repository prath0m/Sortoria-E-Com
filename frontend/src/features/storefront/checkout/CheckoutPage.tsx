import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Banknote, CreditCard, Lock, Pencil } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAddresses } from '@/api/hooks/account';
import { useCart } from '@/api/hooks/cart';
import { useCheckoutConfig, usePlaceOrder } from '@/api/hooks/orders';
import { useStoreSettings } from '@/api/hooks/store';
import { ApiError } from '@/api/client';
import type { Address } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Checkbox, TextArea, TextField } from '@/components/ui/Field';
import { PageLoader } from '@/components/ui/PageLoader';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { cn } from '@/lib/cn';
import { PHONE_RE } from '@/lib/forms';
import { formatMoney } from '@/lib/money';
import { Seo } from '@/lib/seo';
import { useAuth } from '@/stores/auth';
import { useGuestCart } from '@/stores/cart';
import { useCheckoutPrefs } from '@/stores/checkoutPrefs';
import { AddressForm, type AddressValues } from '../account/AddressForm';
import { CouponField } from '../cart/CouponField';
import { formatEta } from '../cart/DeliveryOptions';
import { OrderSummary } from '../cart/OrderSummary';
import { CheckoutProgress } from './CheckoutProgress';
import { usePaymentFlow } from './usePaymentFlow';

type ShippingAddress = Omit<AddressValues, 'label' | 'is_default_shipping'>;

const contactSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  phone: z.string().regex(PHONE_RE, 'Enter a 10-digit mobile number.'),
});

function AddressCard({ address }: { address: ShippingAddress }) {
  return (
    <address className="text-sm not-italic leading-relaxed text-ink-soft">
      <span className="font-semibold text-ink">{address.full_name}</span>
      <br />
      {address.line1}
      {address.line2 ? `, ${address.line2}` : ''}
      <br />
      {address.city}, {address.state} {address.pincode} · +91 {address.phone}
    </address>
  );
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-sm border border-line bg-surface-raised p-5 sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-display-sm">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const slide = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, x: -24, transition: { duration: 0.25 } },
};

export default function CheckoutPage() {
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const signedIn = status === 'authenticated';
  const [paymentMethod, setPaymentMethod] = useState('');
  const { quote, isLoading, isEmpty } = useCart({ paymentMethod });
  const { setPincode, shippingMethod, setShippingMethod, guestCoupon } = useCheckoutPrefs();
  const { data: config } = useCheckoutConfig();
  const { data: store } = useStoreSettings();
  const { data: addresses } = useAddresses(signedIn);
  const guestLines = useGuestCart((s) => s.lines);
  const place = usePlaceOrder();
  const pay = usePaymentFlow();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [contact, setContact] = useState({ email: '', phone: '' });
  const [addressId, setAddressId] = useState<number | null>(null);
  const [newAddress, setNewAddress] = useState<ShippingAddress | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [saveAddress, setSaveAddress] = useState(true);
  const [note, setNote] = useState('');
  // Set once an order exists, so emptying the bag afterwards doesn't bounce us to /cart.
  const leaving = useRef(false);

  const contactForm = useForm<z.infer<typeof contactSchema>>({ resolver: zodResolver(contactSchema) });

  useEffect(() => {
    if (!addresses?.length || addressId || newAddress) return;
    const preferred = addresses.find((a) => a.is_default_shipping) ?? addresses[0];
    setAddressId(preferred.id);
  }, [addresses, addressId, newAddress]);

  const methods = useMemo(() => config?.payment_methods ?? [], [config]);
  useEffect(() => {
    if (!paymentMethod && methods.length) setPaymentMethod(methods[0].code);
  }, [methods, paymentMethod]);

  const savedAddress: Address | undefined = addresses?.find((a) => a.id === addressId);
  const shipping: ShippingAddress | null = useMemo(() => {
    if (newAddress) return newAddress;
    if (savedAddress) {
      const { full_name, phone, line1, line2, landmark, city, state, pincode } = savedAddress;
      return { full_name, phone, line1, line2, landmark, city, state, pincode };
    }
    return null;
  }, [newAddress, savedAddress]);

  useEffect(() => {
    if (shipping?.pincode) setPincode(shipping.pincode);
  }, [shipping?.pincode, setPincode]);

  if (status === 'unknown' || isLoading) return <PageLoader />;
  if (isEmpty && !leaving.current) return <Navigate to="/cart" replace />;

  const go = (next: number) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitDetails = async () => {
    if (!signedIn) {
      const ok = await contactForm.trigger();
      if (!ok) return;
      setContact(contactForm.getValues());
    }
    if (!shipping) {
      toast.error('Please add a delivery address.');
      return;
    }
    go(1);
  };

  const placeOrder = async () => {
    if (!quote || !shipping) return;
    const base = {
      shipping_method: quote.shipping_method || shippingMethod,
      payment_method: paymentMethod,
      customer_note: note,
      expected_total_paise: quote.total_paise,
    };
    const payload = signedIn
      ? {
          ...base,
          phone: shipping.phone,
          ...(newAddress ? { shipping_address: newAddress, save_address: saveAddress } : { address_id: addressId }),
        }
      : {
          ...base,
          email: contact.email,
          phone: contact.phone,
          shipping_address: shipping,
          coupon_code: guestCoupon,
          lines: guestLines.filter((l) => !l.savedForLater).map((l) => ({ variant_id: l.variantId, quantity: l.quantity })),
        };
    try {
      const result = await place.mutateAsync(payload);
      leaving.current = true;
      await pay(result, { fromCheckout: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'stock_changed') {
        toast.error(err.message);
        navigate('/cart');
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Something went wrong placing your order.');
      }
    }
  };

  const shippingOption = quote?.shipping_options.find((o) => o.code === quote.shipping_method);

  return (
    <>
      <Seo title="Checkout" noindex />
      <div className="container-page py-8 lg:py-12">
        <div className="mb-10 flex items-center justify-between gap-4">
          <h1 className="text-display-md">Checkout</h1>
          <span className="flex items-center gap-2 text-xs text-ink-muted">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Secure checkout
          </span>
        </div>
        <CheckoutProgress step={step} onStep={go} />

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              {step === 0 ? (
                <motion.div key="details" {...slide} className="space-y-6">
                  {!signedIn ? (
                    <Panel
                      title="Contact"
                      action={
                        <Link to="/login?next=/checkout" className="text-sm text-burgundy-800 link-underline">
                          Have an account? Sign in
                        </Link>
                      }
                    >
                      <div className="grid gap-5 sm:grid-cols-2">
                        <TextField
                          label="Email"
                          type="email"
                          autoComplete="email"
                          hint="For your receipt and delivery updates."
                          {...contactForm.register('email')}
                          error={contactForm.formState.errors.email?.message}
                        />
                        <TextField
                          label="Mobile number"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          {...contactForm.register('phone')}
                          error={contactForm.formState.errors.phone?.message}
                        />
                      </div>
                    </Panel>
                  ) : null}

                  <Panel title="Delivery address">
                    {signedIn && addresses?.length && !addingAddress && !newAddress ? (
                      <fieldset>
                        <legend className="sr-only">Choose an address</legend>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {addresses.map((a) => (
                            <label
                              key={a.id}
                              className={cn(
                                'flex cursor-pointer gap-3 rounded-sm border p-4 transition-colors',
                                addressId === a.id ? 'border-burgundy-800 bg-burgundy-50/40' : 'border-line hover:border-line-strong',
                              )}
                            >
                              <input
                                type="radio"
                                name="address"
                                className="mt-1 accent-[rgb(var(--burgundy-800))]"
                                checked={addressId === a.id}
                                onChange={() => setAddressId(a.id)}
                              />
                              <AddressCard address={a} />
                            </label>
                          ))}
                        </div>
                        <Button variant="link" className="mt-4" onClick={() => setAddingAddress(true)}>
                          + Deliver somewhere else
                        </Button>
                      </fieldset>
                    ) : newAddress && !addingAddress ? (
                      <div className="flex items-start justify-between gap-4">
                        <AddressCard address={newAddress} />
                        <Button variant="link" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setAddingAddress(true)}>
                          Edit
                        </Button>
                      </div>
                    ) : (
                      <AddressForm
                        initial={newAddress ?? { full_name: user?.full_name ?? '', phone: user?.phone ?? '' }}
                        showDefault={false}
                        submitLabel="Use this address"
                        onCancel={addresses?.length ? () => setAddingAddress(false) : undefined}
                        onSubmit={async (values) => {
                          const { label: _label, is_default_shipping: _default, ...address } = values;
                          setNewAddress(address);
                          setAddressId(null);
                          setAddingAddress(false);
                        }}
                      />
                    )}
                    {signedIn && newAddress ? (
                      <Checkbox
                        className="mt-5"
                        label="Save this address to my account"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                      />
                    ) : null}
                    {quote?.serviceable === false ? (
                      <p role="alert" className="mt-4 text-sm text-danger">
                        We don't deliver to {quote.pincode} yet. Please use a different address.
                      </p>
                    ) : null}
                  </Panel>

                  <div className="flex justify-end">
                    <Button size="lg" onClick={submitDetails} disabled={!shipping || addingAddress || quote?.serviceable === false}>
                      Continue to delivery
                    </Button>
                  </div>
                </motion.div>
              ) : step === 1 ? (
                <motion.div key="delivery" {...slide} className="space-y-6">
                  <Panel title="Delivery speed">
                    <fieldset>
                      <legend className="sr-only">Delivery speed</legend>
                      <div className="space-y-3">
                        {quote?.shipping_options.map((option) => {
                          const selected = quote.shipping_method === option.code;
                          return (
                            <label
                              key={option.code}
                              className={cn(
                                'flex cursor-pointer items-start gap-4 rounded-sm border p-4 transition-colors',
                                selected ? 'border-burgundy-800 bg-burgundy-50/40' : 'border-line',
                                !option.available && 'cursor-not-allowed opacity-50',
                              )}
                            >
                              <input
                                type="radio"
                                name="shipping-method"
                                className="mt-1 accent-[rgb(var(--burgundy-800))]"
                                checked={selected}
                                disabled={!option.available}
                                onChange={() => setShippingMethod(option.code)}
                              />
                              <span className="flex-1">
                                <span className="flex justify-between gap-3 font-medium text-ink">
                                  {option.name}
                                  <span>{option.fee_paise ? formatMoney(option.fee_paise) : 'Complimentary'}</span>
                                </span>
                                <span className="mt-0.5 block text-sm text-ink-muted">
                                  {option.available
                                    ? `${option.eta_from ? `Arrives ${formatEta(option.eta_from, option.eta_to)}. ` : ''}${option.description}`
                                    : option.unavailable_reason}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  </Panel>
                  <Panel title="A note for us">
                    <TextArea
                      label="Delivery instructions or a gift message"
                      optional
                      rows={3}
                      maxLength={500}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </Panel>
                  <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => go(0)}>
                      Back
                    </Button>
                    <Button size="lg" onClick={() => go(2)}>
                      Continue to payment
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="payment" {...slide} className="space-y-6">
                  <Panel title="Review">
                    <dl className="grid gap-5 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="eyebrow mb-1">Deliver to</dt>
                        <dd>{shipping ? <AddressCard address={shipping} /> : null}</dd>
                      </div>
                      <div>
                        <dt className="eyebrow mb-1">Delivery</dt>
                        <dd className="text-ink-soft">
                          {shippingOption?.name}
                          {shippingOption?.eta_from ? (
                            <>
                              <br />
                              Arrives {formatEta(shippingOption.eta_from, shippingOption.eta_to)}
                            </>
                          ) : null}
                        </dd>
                        {!signedIn ? (
                          <>
                            <dt className="eyebrow mb-1 mt-4">Contact</dt>
                            <dd className="text-ink-soft">
                              {contact.email}
                              <br />
                              +91 {contact.phone}
                            </dd>
                          </>
                        ) : null}
                      </div>
                    </dl>
                  </Panel>
                  <Panel title="Payment">
                    <fieldset>
                      <legend className="sr-only">Payment method</legend>
                      <div className="space-y-3">
                        {methods.map((method) => {
                          const cod = method.code === 'cod';
                          const disabled = cod && !quote?.cod_available;
                          const selected = paymentMethod === method.code;
                          return (
                            <label
                              key={method.code}
                              className={cn(
                                'flex cursor-pointer items-start gap-4 rounded-sm border p-4 transition-colors',
                                selected && !disabled ? 'border-burgundy-800 bg-burgundy-50/40' : 'border-line',
                                disabled && 'cursor-not-allowed opacity-50',
                              )}
                            >
                              <input
                                type="radio"
                                name="payment-method"
                                className="mt-1 accent-[rgb(var(--burgundy-800))]"
                                checked={selected && !disabled}
                                disabled={disabled}
                                onChange={() => setPaymentMethod(method.code)}
                              />
                              {cod ? (
                                <Banknote className="mt-0.5 h-5 w-5 text-ink-muted" aria-hidden="true" />
                              ) : (
                                <CreditCard className="mt-0.5 h-5 w-5 text-ink-muted" aria-hidden="true" />
                              )}
                              <span className="flex-1">
                                <span className="block font-medium text-ink">{method.name}</span>
                                <span className="mt-0.5 block text-sm text-ink-muted">
                                  {cod
                                    ? disabled
                                      ? quote?.cod_unavailable_reason
                                      : `Pay when your parcel arrives.${store?.cod_fee_paise ? ` A ${formatMoney(store.cod_fee_paise)} handling fee applies.` : ''}`
                                    : 'Cards, UPI, net banking and wallets, secured by Razorpay.'}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                        {!methods.length ? (
                          <p className="text-sm text-danger">No payment methods are available right now. Please try again shortly.</p>
                        ) : null}
                      </div>
                    </fieldset>
                  </Panel>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    <Button variant="ghost" onClick={() => go(1)}>
                      Back
                    </Button>
                    <Button
                      size="lg"
                      loading={place.isPending}
                      disabled={!paymentMethod || !quote || quote.has_issues}
                      onClick={placeOrder}
                      icon={<Lock className="h-4 w-4" />}
                    >
                      {paymentMethod === 'cod' ? 'Place order' : 'Pay'} {quote ? formatMoney(quote.total_paise) : ''}
                    </Button>
                  </div>
                  <p className="text-center text-xs text-ink-muted sm:text-right">
                    By placing your order you agree to our{' '}
                    <Link to="/pages/terms" className="link-underline">terms</Link> and{' '}
                    <Link to="/pages/returns-policy" className="link-underline">returns policy</Link>.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {quote ? (
            <aside className="lg:sticky lg:top-[calc(var(--header-bottom,6rem)+1.5rem)] lg:self-start" aria-label="Order summary">
              <div className="space-y-6 rounded-sm border border-line bg-surface-raised p-6 shadow-soft">
                <h2 className="text-display-sm">Your order</h2>
                <ul className="space-y-4">
                  {quote.lines.map((line) => (
                    <li key={line.variant_id} className="flex gap-3">
                      <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xs bg-cream-200">
                        {line.image ? (
                          <ResponsiveImage src={line.image.url} renditions={line.image.renditions} alt="" sizes="56px" className="h-full w-full object-cover" />
                        ) : null}
                        <span className="absolute -right-0 -top-0 flex h-5 min-w-5 items-center justify-center rounded-bl-xs bg-ink/80 px-1 text-[0.625rem] font-bold text-cream-50">
                          {line.quantity}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="truncate font-medium">{line.name}</p>
                        <p className="text-ink-muted">{line.variant_label}</p>
                        {line.issue ? <p className="text-danger">{line.issue}</p> : null}
                      </div>
                      <p className="text-sm font-medium">{formatMoney(line.line_total_paise)}</p>
                    </li>
                  ))}
                </ul>
                <CouponField quote={quote} />
                <OrderSummary quote={quote} showTaxSplit />
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </>
  );
}
