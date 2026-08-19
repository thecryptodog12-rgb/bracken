// SPDX-License-Identifier: LGPL-3.0-only

//! Actix envelope routing for proof-generation workflows.

use super::*;

impl Actor for ProofRequestActor {
    type Context = Context<Self>;
}

impl Handler<LoxleyEvent> for ProofRequestActor {
    type Result = ();

    fn handle(&mut self, msg: LoxleyEvent, ctx: &mut Self::Context) -> Self::Result {
        let (msg, ec) = msg.into_components();

        match msg {
            LoxleyEventData::EncryptionKeyPending(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::ThresholdSharePending(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::ComputeResponse(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::ComputeRequestError(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::DecryptionShareProofsPending(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::ShareDecryptionProofPending(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::PkAggregationProofPending(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::AggregationProofPending(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            _ => (),
        }
    }
}

impl Handler<TypedEvent<EncryptionKeyPending>> for ProofRequestActor {
    type Result = ();

    fn handle(
        &mut self,
        msg: TypedEvent<EncryptionKeyPending>,
        _ctx: &mut Self::Context,
    ) -> Self::Result {
        self.handle_encryption_key_pending(msg)
    }
}

impl Handler<TypedEvent<ThresholdSharePending>> for ProofRequestActor {
    type Result = ();

    fn handle(
        &mut self,
        msg: TypedEvent<ThresholdSharePending>,
        _ctx: &mut Self::Context,
    ) -> Self::Result {
        self.handle_threshold_share_pending(msg);
    }
}

impl Handler<TypedEvent<ComputeResponse>> for ProofRequestActor {
    type Result = ();

    fn handle(
        &mut self,
        msg: TypedEvent<ComputeResponse>,
        _ctx: &mut Self::Context,
    ) -> Self::Result {
        self.handle_compute_response(msg)
    }
}

impl Handler<TypedEvent<ComputeRequestError>> for ProofRequestActor {
    type Result = ();

    fn handle(
        &mut self,
        msg: TypedEvent<ComputeRequestError>,
        _ctx: &mut Self::Context,
    ) -> Self::Result {
        self.handle_compute_request_error(msg)
    }
}

impl Handler<TypedEvent<DecryptionShareProofsPending>> for ProofRequestActor {
    type Result = ();

    fn handle(
        &mut self,
        msg: TypedEvent<DecryptionShareProofsPending>,
        _ctx: &mut Self::Context,
    ) -> Self::Result {
        self.handle_decryption_share_proofs_pending(msg)
    }
}

impl Handler<TypedEvent<ShareDecryptionProofPending>> for ProofRequestActor {
    type Result = ();

    fn handle(
        &mut self,
        msg: TypedEvent<ShareDecryptionProofPending>,
        _ctx: &mut Self::Context,
    ) -> Self::Result {
        self.handle_share_decryption_proof_pending(msg)
    }
}

impl Handler<TypedEvent<PkAggregationProofPending>> for ProofRequestActor {
    type Result = ();

    fn handle(
        &mut self,
        msg: TypedEvent<PkAggregationProofPending>,
        _ctx: &mut Self::Context,
    ) -> Self::Result {
        self.handle_pk_aggregation_proof_pending(msg)
    }
}

impl Handler<TypedEvent<AggregationProofPending>> for ProofRequestActor {
    type Result = ();

    fn handle(
        &mut self,
        msg: TypedEvent<AggregationProofPending>,
        _ctx: &mut Self::Context,
    ) -> Self::Result {
        self.handle_aggregation_proof_pending(msg)
    }
}
