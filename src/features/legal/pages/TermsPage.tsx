// src/features/legal/pages/TermsPage.tsx
import React from "react";
import { LegalPageLayout } from "../components/LegalPageLayout";

export function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="May 11, 2026">
      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          1. Acceptance of Terms
        </h2>
        <p className="mb-4 text-muted-foreground">
          By accessing or using The Standard HQ&trade; platform ("Service"), you
          agree to be bound by these Terms of Service ("Terms"). If you do not
          agree to these Terms, do not use the Service.
        </p>
        <p className="mb-4 text-muted-foreground">
          The Service is owned and operated by Nick Neessen, an individual
          residing in Denver, Colorado ("Owner," "we," "us," or "our"). "The
          Standard HQ" is a product name and unregistered trademark used by the
          Owner and does not refer to a separate legal entity, an insurance
          agency, a brokerage, or any other organization.
        </p>
        <p className="text-muted-foreground">
          The Service is intended for use by licensed insurance professionals
          and their agencies. By using the Service, you represent that you have
          the authority to enter into this agreement and that your use complies
          with all agreements you have with your agency, broker-dealer, or
          carriers.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          2. Description of Service
        </h2>
        <p className="mb-4 text-muted-foreground">
          The Standard HQ&trade; is a business management platform designed for
          insurance professionals. The Service provides tools for:
        </p>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>Tracking insurance policies and commissions</li>
          <li>Managing business expenses</li>
          <li>Monitoring sales performance and KPIs</li>
          <li>Team management and recruiting pipeline tracking</li>
          <li>Internal communication and messaging</li>
          <li>Document storage and management</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          3. User Accounts & Registration
        </h2>
        <p className="mb-4 text-muted-foreground">
          Access to the Service requires an approved user account. Account
          registration is by invitation only. You are responsible for:
        </p>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>Maintaining the confidentiality of your account credentials</li>
          <li>All activities that occur under your account</li>
          <li>
            Notifying us immediately of any unauthorized use of your account
          </li>
        </ul>
        <p className="text-muted-foreground">
          We reserve the right to suspend or terminate accounts that violate
          these Terms or remain inactive for extended periods.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          4. User Responsibilities & Representations
        </h2>
        <p className="mb-4 text-muted-foreground">You agree to:</p>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>
            Provide accurate and complete information when using the Service
          </li>
          <li>
            Use the Service in compliance with all applicable laws and
            regulations
          </li>
          <li>Not share your account credentials with unauthorized parties</li>
          <li>
            Not attempt to access, tamper with, or use non-public areas of the
            Service
          </li>
          <li>Not upload malicious code or content</li>
          <li>Respect the intellectual property rights of others</li>
        </ul>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">
            User Representations.
          </span>{" "}
          By accessing or using the Service, you represent and warrant that:
        </p>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>
            You are accessing and using the Service in your individual capacity
            for your own business purposes, and{" "}
            <span className="font-semibold text-foreground">not</span> as a
            representative, agent, employee, or fiduciary of any insurance
            agency, independent marketing organization (IMO), field marketing
            organization (FMO), brokerage, carrier, or other organization;
          </li>
          <li>
            Your use of the Service does not violate any agent agreement,
            independent contractor agreement, employment agreement,
            non-disclosure agreement, non-solicitation agreement, non-compete
            agreement, fiduciary duty, or other obligation you owe to any third
            party;
          </li>
          <li>
            Your use of the Service does not create, and shall not be construed
            to create, any right, license, ownership interest, beneficial
            interest, or other interest in or to the Service or the Platform IP
            for the benefit of any IMO, FMO, agency, brokerage, carrier, or
            other organization with which you are or have been affiliated;
          </li>
          <li>
            No IMO, FMO, agency, brokerage, carrier, or other organization has
            authorized you to negotiate, accept, or modify these Terms on its
            behalf, and your acceptance of these Terms binds only you in your
            individual capacity.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          5. Data Accuracy
        </h2>
        <p className="mb-4 text-muted-foreground">
          You are responsible for the accuracy of all data you enter into the
          Service, including but not limited to policy information, commission
          records, client details, and expense reports.
        </p>
        <p className="text-muted-foreground">
          The Service provides tools for tracking and analysis, but you remain
          responsible for verifying all calculations and data for compliance
          with your carrier agreements and regulatory requirements.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          6. Fees and Payment
        </h2>
        <p className="mb-4 text-muted-foreground">
          The Service is offered as a commercial software product. Access to
          certain features of the Service requires payment of fees ("Fees"). By
          selecting a paid plan or feature, you agree to pay all applicable Fees
          on the schedule disclosed at the time of purchase, authorize the Owner
          or the Owner's payment processor to charge your designated payment
          method, be responsible for all applicable taxes, and keep your payment
          information current and accurate.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">Billing.</span> Fees
          are billed in advance on a recurring basis (monthly, annually, or as
          otherwise specified) unless the Service is offered on a one-time
          basis. Recurring Fees renew automatically until you cancel.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">Cancellation.</span>{" "}
          You may cancel a paid plan at any time by contacting support or
          through your account settings. Cancellation takes effect at the end of
          the current billing period; you retain access to paid features through
          the end of that period.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">Refunds.</span> Except
          where required by applicable law, all Fees are non-refundable. The
          Owner may, in the Owner's sole discretion, issue partial or full
          refunds in cases of demonstrated billing error or extended service
          unavailability.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">Price Changes.</span>{" "}
          The Owner may change Fees at any time. For recurring plans, changes
          will not affect the current billing period but will apply to the next
          renewal, with at least thirty (30) days' advance notice provided.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">Chargebacks.</span> If
          you dispute a charge with your card issuer or payment provider, the
          Owner may suspend or terminate your account pending resolution.
          Wrongful or fraudulent chargebacks may result in permanent
          termination, and the Owner reserves the right to recover the disputed
          amount plus any associated fees and reasonable costs of collection.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">Taxes.</span> You are
          responsible for any sales, use, value-added, withholding, or other
          taxes arising from your payment of Fees, except for taxes based on the
          Owner's net income.
        </p>
        <p className="text-muted-foreground">
          <span className="font-semibold text-foreground">
            Ownership of Revenue.
          </span>{" "}
          All Fees paid for the Service are the sole property of the Owner. No
          portion of any Fee is paid or owed to, held in trust for, or shared
          with any IMO, FMO, agency, brokerage, carrier, or other organization
          with which the Owner is or has been affiliated.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          7. Intellectual Property; Ownership
        </h2>
        <p className="mb-4 text-muted-foreground">
          The Service — including without limitation its source code, object
          code, design, user interface, database schemas, data models,
          algorithms, features, workflows, documentation, branding, logos, trade
          dress, and all related content and materials (collectively, the
          "Platform IP") — is the sole and exclusive property of Nick Neessen in
          his individual capacity. The Platform IP is protected by United States
          and international copyright, trademark, trade secret, patent, and
          other intellectual property laws.
        </p>
        <p className="mb-4 text-muted-foreground">
          All right, title, and interest in and to the Platform IP are and shall
          remain solely and exclusively with the Owner. Nothing in these Terms,
          and no act of accessing, using, contributing data to, paying fees for,
          or otherwise interacting with the Service, transfers or grants any
          ownership interest, license (express or implied), or other right in
          the Platform IP to you or to any other person or entity, except for
          the limited, revocable, non-transferable right to use the Service as
          expressly described in these Terms.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">
            Copyright Notice.
          </span>{" "}
          &copy; {new Date().getFullYear()} Nick Neessen. All rights reserved.
          The Service and all original content thereof are protected by United
          States copyright law.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">Trademarks.</span>{" "}
          "The Standard HQ&trade;" and any associated logos, taglines, or trade
          dress are unregistered trademarks of Nick Neessen. You may not use
          these marks, or any confusingly similar marks, without the Owner's
          prior written permission, except as required to truthfully refer to
          the Service in a manner that does not imply endorsement, sponsorship,
          or affiliation. The Owner reserves all rights in these marks and may
          pursue federal trademark registration at any time.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">Your Data.</span> You
          retain ownership of the business data you input into the Service
          ("Your Data"). By using the Service, you grant the Owner a limited,
          non-exclusive, royalty-free, worldwide license to host, store,
          process, transmit, display, and back up Your Data solely as necessary
          to provide, maintain, secure, and improve the Service for you.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">
            No Joint Ownership.
          </span>{" "}
          No use of the Service, contribution of data, submission of feedback,
          participation in beta testing, payment of subscription fees, or any
          other interaction with the Service creates any joint ownership,
          co-authorship, partnership, equity interest, or beneficial interest in
          the Platform IP. No user is a co-creator or co-author of the Service.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">
            Feedback License.
          </span>{" "}
          Any suggestions, ideas, feature requests, enhancement proposals, bug
          reports, or other feedback you provide regarding the Service
          ("Feedback") is provided voluntarily and without expectation of
          compensation, attribution, or confidentiality. You hereby irrevocably
          assign to the Owner all right, title, and interest in any Feedback,
          including all intellectual property rights therein, and the Owner may
          use, modify, sublicense, and commercialize the Feedback without
          restriction.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">Restrictions.</span>{" "}
          You may not, and may not authorize or permit any third party to: (a)
          copy, modify, adapt, translate, or create derivative works of the
          Service or any portion thereof; (b) reverse engineer, decompile,
          disassemble, or otherwise attempt to derive the source code or
          underlying ideas of the Service; (c) scrape, crawl, harvest, or
          extract data from the Service by automated means except through
          features expressly provided for that purpose; (d) remove, alter, or
          obscure any copyright, trademark, or other proprietary notices; (e)
          use the Service to develop, train, or improve a competing product or
          service; or (f) sublicense, rent, lease, sell, or otherwise transfer
          your access to the Service.
        </p>
        <p className="text-muted-foreground">
          All rights not expressly granted in these Terms are reserved by the
          Owner.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          8. Independent Ownership; No Work-for-Hire; No Agency Interest
        </h2>
        <p className="mb-4 text-muted-foreground">
          You acknowledge and agree that the Service was conceived, designed,
          and developed independently by the Owner, on the Owner's own time,
          using the Owner's own equipment and resources, and at the Owner's own
          expense. The Service is the sole and exclusive property of the Owner
          in his individual capacity.
        </p>
        <p className="mb-4 text-muted-foreground">
          You further acknowledge that:
        </p>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>
            The Service is{" "}
            <span className="font-semibold text-foreground">not</span> a "work
            made for hire" within the meaning of the U.S. Copyright Act (17
            U.S.C. § 101) on behalf of any insurance agency, brokerage, IMO,
            FMO, carrier, employer, principal, or other entity with which the
            Owner is, has been, or may become affiliated;
          </li>
          <li>
            No insurance agency, brokerage, IMO, FMO, carrier, upline, downline,
            business partner, contractor, or other third party has any ownership
            interest, license, beneficial interest, or other right in or to the
            Platform IP by virtue of (i) the Owner's past, present, or future
            agent relationship, contractor relationship, employment
            relationship, commission arrangement, or other business affiliation
            with such entity, (ii) the Owner's use of general industry knowledge
            or skills in developing the Service, or (iii) the Service being made
            available to such entity's agents, members, employees, or
            affiliates;
          </li>
          <li>
            Access to or use of the Service by employees, agents, members,
            contractors, or affiliates of any organization does not create any
            agency relationship, joint venture, partnership, employment
            relationship, fiduciary duty, or ownership interest between the
            Owner and such organization;
          </li>
          <li>
            The Owner's domain expertise as an insurance professional is the
            Owner's own and is not the property of any agency, carrier, or other
            principal, and was applied independently in developing the Service;
          </li>
          <li>
            Any contractor, employment, or agent agreement the Owner has or had
            with any agency, carrier, or other entity does not extend to, cover,
            or assign the Platform IP, and no such agreement shall be construed
            to grant any rights in the Platform IP.
          </li>
        </ul>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">
            No Use of Confidential Information.
          </span>{" "}
          The Service was developed without using, incorporating, or relying
          upon any confidential information, trade secrets, proprietary data,
          commission schedules, override structures, downline data, internal
          forms, training materials, software, or other proprietary property of
          any IMO, FMO, agency, brokerage, carrier, or other principal with
          which the Owner is or has been affiliated. All knowledge applied to
          the development of the Service constitutes the Owner's general
          industry knowledge, publicly available information, or the Owner's own
          original work.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">
            No Use of Third-Party Resources.
          </span>{" "}
          The Service was not developed using the equipment, facilities, office
          space, software licenses, internet access, on-the-clock working hours,
          funding, or other resources of any IMO, FMO, agency, brokerage,
          carrier, or other principal.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">
            No Assignment Through Affiliation Agreements.
          </span>{" "}
          No agent agreement, independent contractor agreement, employment
          agreement, non-disclosure agreement, non-solicitation agreement,
          non-compete agreement, or other written or oral agreement that the
          Owner has entered or may enter into with any insurance agency, IMO,
          FMO, brokerage, carrier, or other entity assigns, transfers,
          encumbers, or grants any rights in or to the Service or the Platform
          IP. The Service was developed outside the scope of any such agreement,
          and to the maximum extent permitted by law any provision of any such
          agreement purporting to assign or grant rights in the Service is
          unenforceable as to the Service.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">
            Commercial Operation by Owner.
          </span>{" "}
          The Service is operated by the Owner as the Owner's independent
          commercial software product. The Owner may charge fees for access to
          the Service or to specific features. The Service is not operated as a
          free internal tool, a benefit, or a service of any IMO, FMO, agency,
          brokerage, or carrier. No revenue generated by the Service belongs to,
          accrues to the benefit of, or must be shared with any IMO, FMO,
          agency, brokerage, carrier, or other organization with which the Owner
          is or has been affiliated.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">
            Use by Affiliated Agents Does Not Create Rights for Their
            Organizations.
          </span>{" "}
          When agents, members, contractors, employees, or affiliates of any
          IMO, FMO, agency, brokerage, or carrier access or use the Service,
          they do so in their individual capacities for their own business
          purposes. The fact that such individuals are affiliated with an
          organization, or that multiple users of the Service happen to share an
          affiliation with the same organization, does not grant that
          organization any ownership, license, beneficial interest, or other
          right in or to the Service. The Service is not provided to, licensed
          to, or operated for the benefit of any IMO, FMO, agency, brokerage, or
          carrier.
        </p>
        <p className="text-muted-foreground">
          Nothing in these Terms or in any related course of dealing shall be
          construed to grant any agency, brokerage, IMO, FMO, carrier, or other
          organization an ownership interest, license, beneficial interest, or
          other right in or to the Service or the Platform IP.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          9. Indemnification
        </h2>
        <p className="mb-4 text-muted-foreground">
          You agree to indemnify, defend, and hold harmless the Owner from and
          against any and all claims, demands, losses, liabilities, damages,
          costs, and expenses (including reasonable attorneys' fees and court
          costs) arising out of or relating to:
        </p>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>Your access to or use of the Service;</li>
          <li>Your violation of these Terms;</li>
          <li>
            Your violation of any rights of another party, including
            intellectual property, privacy, publicity, or contract rights;
          </li>
          <li>Your violation of any applicable law or regulation;</li>
          <li>
            Any content, data, or material you submit to or through the Service;
          </li>
          <li>
            Any claim by any insurance agency, IMO, FMO, brokerage, carrier, or
            other organization with which you are or have been affiliated,
            asserting any right, license, ownership interest, or other interest
            in or to the Service based on your use of the Service or your
            affiliation with the Owner.
          </li>
        </ul>
        <p className="text-muted-foreground">
          The Owner reserves the right to assume the exclusive defense and
          control of any matter subject to indemnification by you, in which case
          you agree to cooperate with the Owner's defense at your expense.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          10. Disclaimer of Warranties; Limitation of Liability
        </h2>
        <p className="mb-4 text-muted-foreground">
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES
          OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY
          WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          NON-INFRINGEMENT, TITLE, OR ACCURACY. TO THE MAXIMUM EXTENT PERMITTED
          BY LAW, THE OWNER SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
          SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES ARISING FROM OR
          RELATING TO YOUR USE OF THE SERVICE, REGARDLESS OF THE THEORY OF
          LIABILITY, EVEN IF THE OWNER HAS BEEN ADVISED OF THE POSSIBILITY OF
          SUCH DAMAGES.
        </p>
        <p className="mb-4 text-muted-foreground">
          IN NO EVENT SHALL THE OWNER'S AGGREGATE LIABILITY ARISING OUT OF OR
          RELATING TO THESE TERMS OR THE SERVICE EXCEED THE GREATER OF (A) THE
          TOTAL AMOUNT OF FEES YOU PAID TO THE OWNER IN THE TWELVE (12) MONTHS
          PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED U.S.
          DOLLARS (US $100).
        </p>
        <p className="text-muted-foreground">
          We do not guarantee uninterrupted access to the Service and are not
          liable for any losses resulting from service interruptions,
          third-party service failures (including without limitation hosting,
          payment processing, email, or AI services), or data loss. You are
          responsible for maintaining your own backups of critical business
          data.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          11. DMCA and Copyright Infringement
        </h2>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">
            Owner's Assertion of Copyright.
          </span>{" "}
          The Owner asserts copyright ownership in all original elements of the
          Service, including without limitation source code, object code,
          designs, user interfaces, screen layouts, documentation, marketing
          copy, and other content authored by the Owner. The Owner will pursue
          infringement of these copyrights to the maximum extent permitted by
          law, including seeking statutory damages and attorneys' fees where
          available.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">
            Notice of Claimed Infringement.
          </span>{" "}
          If you believe content on the Service infringes a copyright you own or
          control, you may submit a notice under the Digital Millennium
          Copyright Act (DMCA) by contacting the Owner with the following
          information:
        </p>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>
            A physical or electronic signature of the copyright owner or
            authorized agent;
          </li>
          <li>
            Identification of the copyrighted work claimed to be infringed;
          </li>
          <li>
            Identification of the allegedly infringing material and its location
            on the Service, with sufficient detail to permit the Owner to locate
            it;
          </li>
          <li>
            Your contact information (mailing address, telephone number, email
            address);
          </li>
          <li>
            A statement that you have a good-faith belief that the disputed use
            is not authorized by the copyright owner, its agent, or the law;
          </li>
          <li>
            A statement, under penalty of perjury, that the information in your
            notice is accurate and that you are the copyright owner or
            authorized to act on behalf of the copyright owner.
          </li>
        </ul>
        <p className="mb-4 text-muted-foreground">
          Send notices to:{" "}
          <a
            href="mailto:support@thestandardhq.com"
            className="text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            support@thestandardhq.com
          </a>
          .
        </p>
        <p className="text-muted-foreground">
          <span className="font-semibold text-foreground">
            Counter-Notification.
          </span>{" "}
          If you believe content of yours was removed in error, you may submit a
          counter-notification containing comparable information. Repeated,
          knowingly false, or bad-faith notices may result in liability under 17
          U.S.C. § 512(f).
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          12. Termination
        </h2>
        <p className="mb-4 text-muted-foreground">
          Either party may terminate this agreement at any time. Upon
          termination:
        </p>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>Your access to the Service will be revoked;</li>
          <li>
            You may request an export of your data within thirty (30) days of
            termination;
          </li>
          <li>
            We may retain certain data as required by law or for legitimate
            business purposes (including financial records, audit logs, and
            fraud prevention).
          </li>
        </ul>
        <p className="text-muted-foreground">
          Sections 6 (Fees and Payment, with respect to amounts owed prior to
          termination), 7 (Intellectual Property), 8 (Independent Ownership), 9
          (Indemnification), 10 (Disclaimer of Warranties; Limitation of
          Liability), 11 (DMCA), 13 (Governing Law), and 14 (General Provisions)
          shall survive any termination of this agreement.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          13. Governing Law & Dispute Resolution
        </h2>
        <p className="mb-4 text-muted-foreground">
          These Terms shall be governed by and construed in accordance with the
          laws of the State of Colorado, without regard to its conflict of laws
          principles. These Terms are intended to be enforceable in all
          jurisdictions of the United States; if any legal action is initiated
          in a court of any state, that court shall apply Colorado law to the
          substantive issues.
        </p>
        <p className="mb-4 text-muted-foreground">
          Any dispute, claim, or controversy arising out of or relating to these
          Terms, the Service, or the Platform IP shall be resolved exclusively
          through final and binding arbitration administered by the American
          Arbitration Association (AAA) under its Commercial Arbitration Rules,
          conducted in Denver, Colorado or remotely at the arbitrator's
          discretion. Judgment on the arbitration award may be entered in any
          court of competent jurisdiction.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">
            Carve-Out for Equitable Relief.
          </span>{" "}
          Notwithstanding the foregoing, the Owner may seek injunctive or other
          equitable relief in any court of competent jurisdiction to protect the
          Platform IP or to enforce intellectual property rights.
        </p>
        <p className="text-muted-foreground">
          <span className="font-semibold text-foreground">
            Class Action Waiver.
          </span>{" "}
          You waive any right to participate in a class action, class
          arbitration, consolidated action, or other representative proceeding.
          All disputes must be brought in your individual capacity only.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          14. General Provisions
        </h2>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">
            Entire Agreement.
          </span>{" "}
          These Terms, together with the Privacy Policy, constitute the entire
          agreement between you and the Owner regarding the Service and
          supersede all prior agreements, communications, representations, and
          understandings, whether written or oral.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">Severability.</span>{" "}
          If any provision of these Terms is held to be invalid, illegal, or
          unenforceable, the remaining provisions shall remain in full force and
          effect, and the invalid provision shall be modified to the minimum
          extent necessary to make it enforceable while preserving its intent.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">Assignment.</span> You
          may not assign or transfer your rights or obligations under these
          Terms without the Owner's prior written consent. Any attempted
          assignment without such consent is void. The Owner may freely assign
          these Terms and the Platform IP, including without limitation to a
          successor entity such as a limited liability company or corporation
          formed by the Owner to hold the Service.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">No Waiver.</span> The
          Owner's failure to enforce any provision of these Terms shall not
          constitute a waiver of that provision or of any other provision, and
          no waiver shall be effective unless in writing and signed by the
          Owner.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">
            No Partnership or Agency.
          </span>{" "}
          Nothing in these Terms creates any partnership, joint venture,
          employment, fiduciary, or agency relationship between you and the
          Owner. You have no authority to bind the Owner or hold yourself out as
          an agent or representative of the Owner.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">Force Majeure.</span>{" "}
          The Owner shall not be liable for any failure or delay in performance
          due to causes beyond the Owner's reasonable control, including without
          limitation acts of God, natural disasters, war, terrorism, civil
          unrest, pandemic, labor disputes, third-party service outages, or
          governmental action.
        </p>
        <p className="mb-4 text-muted-foreground">
          <span className="font-semibold text-foreground">
            Headings; Construction.
          </span>{" "}
          Section headings are for convenience only and do not affect
          interpretation. Ambiguities shall not be construed against the
          drafter.
        </p>
        <p className="text-muted-foreground">
          <span className="font-semibold text-foreground">
            No Third-Party Beneficiaries.
          </span>{" "}
          These Terms are for the sole benefit of you and the Owner and do not
          confer any rights on any third party.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          15. Contact Information
        </h2>
        <p className="text-muted-foreground">
          For questions about these Terms of Service, please contact us at{" "}
          <a
            href="mailto:support@thestandardhq.com"
            className="text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            support@thestandardhq.com
          </a>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
}
